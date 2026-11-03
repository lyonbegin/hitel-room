#!/usr/bin/env python3
"""Integrate HITEL's HFP->BLE adapter into Espressif ESP-IDF v5.5 hfp_hf example.

Usage:
  python3 patch_reference_hfp.py /path/to/esp-idf/examples/bluetooth/bluedroid/classic_bt/hfp_hf

This patches a disposable copy of the Espressif sample. It never modifies the
HITEL iPhone app or the user's installed Phone app.
"""
from pathlib import Path
import re
import shutil
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: patch_reference_hfp.py <hfp_hf-example-project>")
root = Path(sys.argv[1]).expanduser().resolve()
main = root / "main"
if not (main / "bt_app_hf.c").exists() or not (main / "main.c").exists():
    raise SystemExit("Expected Espressif hfp_hf/main/{bt_app_hf.c, main.c}")
source = Path(__file__).resolve().parent
for filename in ("hitel_ble_bridge.c", "hitel_ble_bridge.h"):
    shutil.copy2(source / filename, main / filename)

def replace_exact(text: str, before: str, after: str, label: str) -> str:
    if after in text:
        return text
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}; inspect ESP-IDF version")
    return text.replace(before, after)

main_path = main / "main.c"
text = main_path.read_text()
text = replace_exact(
    text,
    '#include "esp_hf_client_api.h"',
    '#include "esp_hf_client_api.h"\n#include "hitel_ble_bridge.h"',
    "main.c HFP include"
) if '#include "esp_hf_client_api.h"' in text else text
# Always place the include before the first existing include (independent of
# Espressif's include order across minor ESP-IDF updates).
if '#include "hitel_ble_bridge.h"' not in text:
    text = '#include "hitel_ble_bridge.h"\n' + text
text = text.replace(
    "ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_BLE));",
    "/* HITEL needs Classic Bluetooth HFP and BLE GATT simultaneously. */"
)
text = replace_exact(
    text,
    "esp_bt_controller_enable(ESP_BT_MODE_CLASSIC_BT)",
    "esp_bt_controller_enable(ESP_BT_MODE_BTDM)",
    "BTDM controller mode"
)
if "ESP_ERROR_CHECK(hitel_ble_init());" not in text:
    marker = 'ESP_LOGI(BT_HF_TAG, "Own address:'
    if marker not in text:
        raise SystemExit("Cannot find post-Bluedroid initialization point in main.c")
    text = text.replace(marker,
        'ESP_ERROR_CHECK(hitel_ble_init());\n' + marker, 1)
main_path.write_text(text)

hf_path = main / "bt_app_hf.c"
text = hf_path.read_text()
if '#include "hitel_ble_bridge.h"' not in text:
    text = '#include "hitel_ble_bridge.h"\n' + text
# Do not echo the remote party's audio into the phone's uplink. For the FIRST
# RX-only caption bench test we send silence in place of a headset microphone.
# Real voice uplink will require a separate capture/TTS path in the accessory.
outgoing = re.compile(
    r'static uint32_t bt_app_hf_client_outgoing_cb\(uint8_t \*p_buf, uint32_t sz\)\s*'
    r'\{.*?\n\}\s*(?=static void bt_app_hf_client_incoming_cb)',
    re.S
)
outgoing_body = (
    "static uint32_t bt_app_hf_client_outgoing_cb(uint8_t *p_buf, uint32_t sz)\n"
    "{\n"
    "    memset(p_buf, 0, sz); /* RX-only test: avoid unsafe far-end echo */\n"
    "    return sz;\n"
    "}\n"
)
if outgoing_body not in text:
    text, count = outgoing.subn(outgoing_body, text)
    if count != 1:
        raise SystemExit("Expected exactly one decoded HFP uplink callback")
incoming_pattern = re.compile(
    r'static void bt_app_hf_client_incoming_cb\(const uint8_t \*buf, uint32_t sz\)\s*'
    r'\{.*?\n\}',
    re.S,
)
incoming_body = (
    "static void bt_app_hf_client_incoming_cb(const uint8_t *buf, uint32_t sz)\n"
    "{\n"
    "    /* Actual remote PCM downlink. Do not enqueue it as headset uplink. */\n"
    "    hitel_ble_submit_pcm8k(buf, sz);\n"
    "    esp_hf_client_outgoing_data_ready();\n"
    "}\n"
)
if incoming_body.strip() not in text:
    text, count = incoming_pattern.subn(lambda _: incoming_body.rstrip(), text)
    if count != 1:
        raise SystemExit("Expected exactly one decoded HFP incoming callback")
hf_path.write_text(text)

cmake_path = main / "CMakeLists.txt"
cmake = cmake_path.read_text()
if '"hitel_ble_bridge.c"' not in cmake:
    cmake = replace_exact(
        cmake,
        'idf_component_register(SRCS ',
        'idf_component_register(SRCS "hitel_ble_bridge.c"\n',
        "CMake component sources"
    )
cmake_path.write_text(cmake)

print("HITEL HFP/BLE overlay applied.")
print("IMPORTANT: use ESP-IDF v5.5 and set target esp32 (classic dual-mode ESP32).")
print("Configure HFP audio=HCI, external codec=off, wideband speech=off.")
print("The prototype intentionally sends SILENCE upstream; it is a remote RX caption experiment.")
print("Flash and physically pair the adapter before live remote PCM frames can exist.")
