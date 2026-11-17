#!/usr/bin/env python3
"""Samsung Remote Test Lab browser UI automator for the SAME GitHub Ubuntu Chrome.

User intervention is strictly Samsung login/2FA (via protected noVNC).
All steps after login are attempted by Playwright attached over local CDP:
start testing, choose Galaxy Z Fold device, reserve a short session, open
Remote Debug Bridge, download Linux rdb ZIP, and connect + RSA approval.

Site UI is third-party and can change. Never assert successful reservation
from a click; the device is VERIFIED only by Samsung RDB/ADB connectivity.
Do not export cookies, passwords, local Chrome profile, screenshots, DOM
snapshots, browser recordings or WebSocket sessions to GitHub logs/artifacts.
"""
from __future__ import annotations

import argparse
import os
import re
import time
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, Error as PlaywrightError, TimeoutError as PlaywrightTimeout

SAMSUNG = "developer.samsung.com"
RTL = "https://developer.samsung.com/remote-test-lab"
FOLD_FAMILY = "https://developer.samsung.com/remotetestlab/devices/126/Galaxy-Z"

# Avoid interacting with any commerce purchase, external OAuth consent, or
# account settings. Website interactions must stay within Samsung RTL pages.
BOOK_ACTIONS = (
    re.compile(r"^Reserve$", re.I),
    re.compile(r"^Reserve Now$", re.I),
    re.compile(r"^Start Testing$", re.I),
    re.compile(r"^Start Test$", re.I),
)
RDB_MENU = re.compile(r"^Remote Debug Bridge$", re.I)
RDB_CONNECT = re.compile(r"^Connect$", re.I)
RDB_DOWNLOAD = re.compile(r"^Download$", re.I)
FOLD = re.compile(r"Galaxy\s*Z\s*Fold\s*(8|7|6|5)?", re.I)
STAGE_FILE=Path(os.environ.get("RTL_BROWSER_STAGE_FILE","/tmp/rtl-browser-stage.txt"))
STAGES=set()
def mark(stage):
    if not re.fullmatch(r"[A-Z0-9_]{4,64}",stage): return
    if stage not in STAGES:
        STAGES.add(stage)
        STAGE_FILE.parent.mkdir(parents=True,exist_ok=True)
        STAGE_FILE.write_text(stage)
        print("RTL_STAGE_"+stage,flush=True)


def safe_click(locator, label: str) -> bool:
    try:
        if locator.count() != 1 or not locator.is_visible(timeout=1500):
            return False
        locator.click(timeout=2500)
        print("RTL_BROWSER_ACTION_" + label, flush=True)
        mark(label)
        return True
    except (PlaywrightError, PlaywrightTimeout):
        return False

def exact_text(frame, label):
    """Find a Samsung control whose accessible text is within a non-button span."""
    return frame.get_by_text(re.compile("^" + re.escape(label) + "$", re.I), exact=True)


def visible_pages(browser):
    return [
        page for ctx in browser.contexts for page in ctx.pages
        if not page.is_closed()
        and (SAMSUNG in page.url.lower() or
             "remotetestlab" in page.url.lower())
    ]

def frames(page):
    for frame in page.frames:
        if frame.is_detached():
            continue
        yield frame

def roles(frame, role: str, pattern):
    return frame.get_by_role(role, name=pattern)

def rdb_phase(browser, rdb_file: Path, flag: dict) -> bool:
    for page in reversed(visible_pages(browser)):
        for frame in frames(page):
            # The Samsung RTC page's sidebar RDB menu is not account login UI.
            if not flag.get("menu"):
                for role in ("button", "link", "menuitem", "tab"):
                    if safe_click(roles(frame, role, RDB_MENU), "RDB_MENU"):
                        flag["menu"] = True
                        return True
                # Samsung's current RTL sidebar can be non-semantic text
                # (not accessible as a button/link). Match the visible label.
                if safe_click(frame.get_by_text(RDB_MENU, exact=True), "RDB_MENU"):
                    flag["menu"] = True
                    return True

            if flag.get("menu") and not flag.get("connect_request"):
                for role in ("button", "link"):
                    if safe_click(roles(frame, role, RDB_CONNECT), "RDB_CONNECT_REQUEST"):
                        flag["connect_request"] = True
                        return True
                if safe_click(frame.get_by_text(RDB_CONNECT, exact=True), "RDB_CONNECT_REQUEST"):
                    flag["connect_request"]=True
                    return True

            # Once RDB connect shows the ZIP download pop-up, download
            # in SAME Chrome so the worker can launch official Linux ELF.
            if flag.get("connect_request") and not rdb_file.exists():
                for role in ("link", "button"):
                    locator=roles(frame,role,RDB_DOWNLOAD)
                    try:
                        if locator.count()!=1 or not locator.is_visible(timeout=1500):
                            continue
                        with page.expect_download(timeout=12000) as d:
                            locator.click(timeout=2500)
                        download=d.value
                        if not download.suggested_filename.lower().endswith(".zip"):
                            mark("RDB_DOWNLOAD_NONZIP_REJECTED")
                            continue
                        target=Path.home()/"Downloads"/"samsung-rdb.zip"
                        target.parent.mkdir(parents=True,exist_ok=True)
                        download.save_as(str(target))
                        mark("RDB_ZIP_DOWNLOADED_IN_LINUX_RUNNER")
                        flag["download"]=True
                        return True
                    except (PlaywrightError,PlaywrightTimeout) as exc:
                        # Chrome may have handled download directly.
                        mark("RDB_DOWNLOAD_EVENT_UNCONFIRMED")
                        print("RTL_RDB_DOWNLOAD_TYPE="+type(exc).__name__,flush=True)
                        continue

            # The helper process launches extracted RDB after Chrome
            # downloads the ZIP. Then connect again from the SAME page.
            if rdb_file.exists() and not flag.get("second_connect"):
                for role in ("button", "link"):
                    if safe_click(roles(frame, role, RDB_CONNECT), "RDB_CONNECT_FINAL"):
                        flag["second_connect"] = True
                        return True
                if safe_click(frame.get_by_text(RDB_CONNECT, exact=True), "RDB_CONNECT_FINAL"):
                    flag["second_connect"]=True
                    return True

            if rdb_file.exists() and flag.get("second_connect"):
                # Samsung RTL may render the phone's RSA approval as its
                # remote-device preview. Click only an explicitly labelled
                # Allow control, never arbitrary image coordinates.
                for role in ("button", "link"):
                    if safe_click(roles(frame, role, re.compile(r"^Allow$", re.I)),
                                  "RDB_RSA_ALLOW"):
                        return True
    return False


def manually_selected_fold(page) -> bool:
    """Detect an already-selected Fold without relying on a button click made by Playwright.

    Selecting a Fold tile manually opens preference controls. Do not confuse
    a general device catalog listing (with many Fold tiles) with a selection.
    Only observe visible text/control semantics; never read passwords/cookies.
    """
    for frame in frames(page):
        try:
            # A reservation dialog is sufficient only if it names a Fold.
            dialogs=frame.get_by_role("dialog").filter(has_text=FOLD)
            if dialogs.count()==1 and dialogs.is_visible(timeout=1000):
                return True

            headings=frame.get_by_role("heading",name=FOLD)
            if headings.count()!=1 or not headings.is_visible(timeout=1000):
                continue

            # An actual device preference form includes the Start/Reserve
            # control plus location or duration. A catalog page may have
            # multiple Fold names but should not satisfy these together.
            start=frame.get_by_role("button",name=re.compile(r"^(Start|Reserve|Book)(?: Now)?$",re.I))
            preference=frame.get_by_text(
                re.compile(r"^(Location|Select Location|Duration|Select Duration|Usage Time|Reservation Time)$",re.I)
            )
            if start.count()>=1 and preference.count()>=1:
                return True
        except (PlaywrightError,PlaywrightTimeout):
            continue
    return False


def booking_phase(browser, flag: dict) -> bool:
    pages = visible_pages(browser)
    if not pages:
        return False

    # If user's Samsung authentication is still being entered, only wait.
    # Never write credentials or click Sign in/Continue/OTP controls.
    for page in reversed(pages):
        if "account.samsung.com" in page.url.lower():
            return False

    for page in reversed(pages):
        # Crucial: the operator may have selected the Fold personally via noVNC.
        # That action does not call safe_click() and does not set fold_selected.
        if not flag.get("fold_selected") and manually_selected_fold(page):
            flag["fold_selected"]=True
            mark("MANUAL_GALAXY_FOLD_SELECTION_DETECTED")
            return True

        if not flag.get("start_testing"):
            for frame in frames(page):
                for label in ("Get Started", "START TESTING", "Start Testing", "Start testing"):
                    for role in ("button", "link"):
                        if safe_click(
                            roles(frame, role, re.compile("^" + re.escape(label) + "$", re.I)),
                            "START_TESTING"):
                            flag["start_testing"] = True
                            return True

        if not flag.get("galaxy_mobile"):
            for frame in frames(page):
                for role in ("button", "link", "tab"):
                    if safe_click(roles(frame, role, re.compile(r"^Galaxy Mobile$", re.I)),
                                  "GALAXY_MOBILE"):
                        flag["galaxy_mobile"] = True
                        return True

        if not flag.get("fold_selected"):
            for frame in frames(page):
                for role in ("link", "button"):
                    # Only a unique Fold entry is safe, otherwise prefer a
                    # specific newest device (8, 7, 6) when available.
                    for name in (
                        re.compile(r"^Galaxy\s+Z\s+Fold8$", re.I),
                        re.compile(r"^Galaxy\s+Z\s+Fold7$", re.I),
                        re.compile(r"^Galaxy\s+Z\s+Fold6$", re.I),
                        re.compile(r"^Galaxy\s+Z\s+Fold", re.I),
                    ):
                        if safe_click(roles(frame, role, name), "GALAXY_FOLD_SELECT"):
                            flag["fold_selected"] = True
                            return True

        # Samsung requires device location and reservation duration before Start.
        # These are website bootstrap actions; after RDB connects, all app work uses Linux ADB.
        if flag.get("fold_selected") and not flag.get("region_selected"):
            for frame in frames(page):
                for role in ("button","radio","option","listitem","link"):
                    for pattern in (
                        re.compile(r"^South Korea$",re.I),
                        re.compile(r"^Korea(?:, Republic of)?$",re.I),
                        re.compile(r"^Seoul(?:,? Korea)?$",re.I),
                    ):
                        if safe_click(roles(frame,role,pattern),"REGION_SELECTED"):
                            flag["region_selected"]=True
                            return True
                for label in ("Seoul","South Korea","Korea","Korea, Republic of"):
                    if safe_click(exact_text(frame,label),"REGION_SELECTED"):
                        flag["region_selected"]=True
                        return True
                if not flag.get("region_selector_attempted"):
                    for role in ("combobox","button","link"):
                        for label in ("Location","Select Location","Select Region","Region"):
                            if safe_click(roles(frame,role,re.compile("^"+re.escape(label)+"$",re.I)),
                                          "REGION_SELECTOR_OPENED"):
                                flag["region_selector_attempted"]=True
                                return True
                for item in frame.locator("select").all()[:4]:
                    try:
                        candidates=[
                            o.get_attribute("value") for o in item.locator("option").all()
                            if re.search(r"korea|seoul",o.inner_text(),re.I)
                            and o.get_attribute("value")
                        ]
                        if candidates:
                            item.select_option(value=candidates[0],timeout=2500)
                            flag["region_selected"]=True
                            mark("REGION_SELECTED")
                            return True
                    except (PlaywrightError,PlaywrightTimeout):
                        pass

        if flag.get("fold_selected") and not flag.get("duration_selected"):
            for frame in frames(page):
                for role in ("radio","option","button","link"):
                    if safe_click(roles(frame,role,re.compile(r"^(30\s*min(utes)?|30\s*m|0:30|30)$",re.I)),
                                  "THIRTY_MINUTE_SESSION"):
                        flag["duration_selected"]=True
                        return True
                for label in ("30 minutes","30 mins","30 min","30m","30"):
                    if safe_click(exact_text(frame,label),"THIRTY_MINUTE_SESSION"):
                        flag["duration_selected"]=True
                        return True
                if not flag.get("duration_selector_attempted"):
                    for role in ("combobox","button"):
                        for label in ("Duration","Select Duration","Usage Time","Reservation Time","Time"):
                            if safe_click(roles(frame,role,re.compile("^"+re.escape(label)+"$",re.I)),
                                          "DURATION_SELECTOR_OPENED"):
                                flag["duration_selector_attempted"]=True
                                return True
                for item in frame.locator("select").all()[:4]:
                    try:
                        candidates=[
                            o.get_attribute("value") for o in item.locator("option").all()
                            if re.search(r"^(30\s*min(utes)?|0:30|30)$",o.inner_text().strip(),re.I)
                            and o.get_attribute("value")
                        ]
                        if candidates:
                            item.select_option(value=candidates[0],timeout=2500)
                            flag["duration_selected"]=True
                            mark("THIRTY_MINUTE_SESSION")
                            return True
                    except (PlaywrightError,PlaywrightTimeout):
                        pass

        # Automatic booking is attempted ONLY when a specific Fold has
        # been selected. No blind booking of unrelated devices.
        if flag.get("fold_selected") and not flag.get("reserve_requested"):
            for frame in frames(page):
                for name in (re.compile(r"^Start$",re.I),re.compile(r"^Start Testing$",re.I),
                             re.compile(r"^Reserve(?: Now)?$",re.I),re.compile(r"^Book(?: Now)?$",re.I)):
                    for role in ("button", "link", "menuitem"):
                        if safe_click(roles(frame, role, name), "FOLD_RESERVE_REQUESTED"):
                            flag["reserve_requested"] = True
                            return True
                for label in ("Start","Reserve","Reserve Now","Start Testing"):
                    if safe_click(exact_text(frame,label),"FOLD_RESERVE_REQUESTED"):
                        flag["reserve_requested"]=True
                        return True

        # Reservation may require selecting a session length. Prefer 30 min.
        if flag.get("reserve_requested") and not flag.get("duration_selected"):
            for frame in frames(page):
                for role in ("button", "option", "radio"):
                    if safe_click(
                        roles(frame, role, re.compile(r"^(30\s*min(utes)?|0:30|30)$", re.I)),
                        "THIRTY_MINUTE_SESSION"):
                        flag["duration_selected"] = True
                        return True

        if flag.get("reserve_requested") and not flag.get("reserve_confirmed"):
            for frame in frames(page):
                for role in ("button", "link"):
                    for pat in (re.compile(r"^Start$", re.I),
                                re.compile(r"^Launch$", re.I),
                                re.compile(r"^Confirm Reservation$", re.I)):
                        if safe_click(roles(frame, role, pat), "FOLD_RESERVE_CONFIRM"):
                            flag["reserve_confirmed"] = True
                            return True
    return False


def run(minutes: int, rdb_file: Path):
    stage = {}
    last_heartbeat = 0.0
    deadline = time.monotonic() + 60 * minutes
    print("RTL_BROWSER_AUTO_READY; ONLY Samsung account login/2FA requested from operator",flush=True)
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(
            "http://127.0.0.1:9222", timeout=30000
        )
        while time.monotonic() < deadline:
            try:
                if rdb_phase(browser, rdb_file, stage):
                    time.sleep(4)
                    continue
                if booking_phase(browser, stage):
                    time.sleep(5)
                    continue
                # If no buttons were safely identified, keep the remote
                # desktop available and retry when the page changes.
                if time.monotonic() - last_heartbeat > 90:
                    last_heartbeat = time.monotonic()
                    if stage.get("fold_selected") and not stage.get("reserve_requested"):
                        mark("FOLD_SELECTED_RESERVATION_UI_UNMATCHED")
                    elif stage.get("reserve_requested") and not stage.get("reserve_confirmed"):
                        mark("FOLD_RESERVATION_REQUESTED_RDB_PENDING")
                    elif stage.get("second_connect"):
                        mark("RDB_CONNECT_REQUESTED_ADB_PENDING")
                    else:
                        mark("WAITING_FOR_SAMSUNG_RTL_OR_LOGIN")
                    print("RTL_BROWSER_HEARTBEAT_RDB_FIRST",flush=True)
            except (PlaywrightError, PlaywrightTimeout) as err:
                print("RTL_BROWSER_TRANSIENT_ERROR_TYPE=" + type(err).__name__,
                      flush=True)
            time.sleep(10)
        print("RTL_BROWSER_AUTO_DEADLINE_REACHED",flush=True)


if __name__ == "__main__":
    a=argparse.ArgumentParser()
    a.add_argument("--minutes",type=int,default=90)
    a.add_argument("--rdb-file",type=Path,required=True)
    opts=a.parse_args()
    run(opts.minutes,opts.rdb_file)
