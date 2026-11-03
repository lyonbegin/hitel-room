// HITEL HFP -> BLE audio accessory integration (ESP-IDF v5.5, classic ESP32)
// Incoming PCM must be remote/downlink audio decoded by ESP32's HFP HF stack.
// Use only after Bluetooth controller is enabled in dual-mode (BTDM) and
// Bluedroid has been enabled. Not an iOS cellular audio interception API.
#pragma once
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t hitel_ble_init(void);
void hitel_ble_submit_pcm8k(const uint8_t *little_endian_pcm16, size_t bytes);

#ifdef __cplusplus
}
#endif
