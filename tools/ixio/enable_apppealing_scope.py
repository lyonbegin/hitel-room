#!/usr/bin/env python3
"""Enable the installed AppPealing LSPosed module for both test packages.

Operate on the disposable emulator only. SQLite DB is copied while the LSPosed
daemon is suspended, updated offline, and restored immediately before reboot.
"""
import pathlib
import sqlite3
import subprocess
import sys
import tempfile

PKGS = ("com.lguplus.aicallagent", "com.lguplus.callrecorder")
MODULE = "com.october.apppealing"
DEVICE_DB = "/data/adb/lspd/config/modules_config.db"

def run(*args, check=True):
    p = subprocess.run(["adb", *args], text=True, capture_output=True, timeout=45)
    print("$ adb", " ".join(args), "exit=", p.returncode, "stdout=", p.stdout[-1800:], "stderr=", p.stderr[-700:])
    if check and p.returncode:
        raise RuntimeError("ADB command failed: " + " ".join(args))
    return p.stdout

def main():
    run("root")
    path_lines = run("shell", "pm", "path", MODULE).strip().splitlines()
    apks = [x.partition("package:")[2].strip() for x in path_lines if x.startswith("package:")]
    if not apks: raise RuntimeError("AppPealing package not installed")
    apk_path = apks[0]
    run("shell", "su", "-c", "ls -l " + DEVICE_DB)
    # Freeze LSPosed's in-memory SQLite caches until the system reboots.
    run("shell", "su", "-c", "killall -STOP lspd", check=False)
    with tempfile.TemporaryDirectory(prefix="ixio_scope_") as td:
        base = pathlib.Path(td)
        db_file = base / "modules_config.db"
        run("pull", DEVICE_DB, str(db_file))
        for suffix in ("-wal", "-shm"):
            run("pull", DEVICE_DB+suffix, str(db_file)+suffix, check=False)
        db = sqlite3.connect(db_file)
        try:
            names = {t[0] for t in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {"modules", "scope"}.issubset(names):
                raise RuntimeError("Unexpected LSPosed schema: " + repr(names))
            db.execute("PRAGMA busy_timeout=3000")
            db.execute("PRAGMA journal_mode=DELETE")
            db.execute(
                "INSERT INTO modules(module_pkg_name, apk_path, enabled) VALUES(?,?,1) "
                "ON CONFLICT(module_pkg_name) DO UPDATE SET apk_path=excluded.apk_path,enabled=1",
                (MODULE, apk_path),
            )
            mid = db.execute("SELECT mid FROM modules WHERE module_pkg_name=?", (MODULE,)).fetchone()[0]
            for target in PKGS:
                db.execute("INSERT OR IGNORE INTO scope(mid,app_pkg_name,user_id) VALUES(?,?,0)", (mid, target))
            db.commit()
            print("MODULE_SCOPE_UPDATED", db.execute(
                "SELECT m.module_pkg_name,m.enabled,s.app_pkg_name,s.user_id FROM modules m "
                "JOIN scope s ON m.mid=s.mid WHERE m.module_pkg_name=?", (MODULE,)
            ).fetchall())
        finally:
            db.close()
        run("push", str(db_file), "/data/local/tmp/ixio-lsposed-config.db")
        run("shell", "su", "-c", "cp /data/local/tmp/ixio-lsposed-config.db " + DEVICE_DB + " && "
            "chmod 600 " + DEVICE_DB + " && "
            "rm -f " + DEVICE_DB + "-wal " + DEVICE_DB + "-shm && "
            "(restorecon " + DEVICE_DB + " || true)")
    print("SCOPE_SETUP=PASS; rebooting")
    run("reboot", check=False)

if __name__ == "__main__":
    try: main()
    except Exception as e:
        print("SCOPE_SETUP=FAIL:", str(e), file=sys.stderr)
        sys.exit(1)
