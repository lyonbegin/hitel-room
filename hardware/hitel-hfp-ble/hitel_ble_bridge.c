// HITEL cellular HFP downlink -> BLE IMA ADPCM stream.
// Based on ESP-IDF Bluedroid APIs; intended for a classic BT + BLE ESP32.
// This module only forwards decoded remote/downlink PCM from the HFP HF unit.
// The regular telephone path remains on the phone and does NOT flow through
// WebRTC or a PSTN gateway.
#include "hitel_ble_bridge.h"
#include <stdbool.h>
#include <string.h>
#include "esp_log.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_gatt_common_api.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

#define HITEL_SAMPLES_PER_PACKET 160
#define HITEL_ENCODED_BYTES 80
#define HITEL_PACKET_BYTES 90
#define HITEL_QUEUE_DEPTH 48
#define HITEL_GATT_APP_ID 0x52

static const char *TAG = "HITEL_HFP_BLE";
static const uint8_t SERVICE_UUID[16] = {
    0x01, 0xA3, 0xC1, 0x81, 0xC5, 0xA2, 0xC0, 0xBA,
    0x76, 0x4E, 0xC7, 0x9B, 0x00, 0x10, 0x2B, 0x7D
};
static const uint8_t AUDIO_UUID[16] = {
    0x01, 0xA3, 0xC1, 0x81, 0xC5, 0xA2, 0xC0, 0xBA,
    0x76, 0x4E, 0xC7, 0x9B, 0x01, 0x10, 0x2B, 0x7D
};

typedef struct {
    uint8_t bytes[HITEL_PACKET_BYTES];
} hitel_packet_t;

static QueueHandle_t tx_queue;
static esp_gatt_if_t gatts_if;
static uint16_t service_handle;
static uint16_t char_handle;
static uint16_t ccc_handle;
static uint16_t conn_id;
static uint16_t negotiated_mtu = 23;
static bool is_connected;
static bool subscribed;
static uint16_t sequence_id;
static int16_t pending_pcm[HITEL_SAMPLES_PER_PACKET];
static size_t pending_length;

static const int16_t step_table[89] = {
    7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,
    34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,
    157,173,190,209,230,253,279,307,337,371,408,449,494,544,
    598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,
    1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,
    4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,
    12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767
};
static const int8_t index_delta[8] = {-1,-1,-1,-1,2,4,6,8};

static uint8_t encode_ima_sample(int16_t pcm, int *predictor, int *step_index) {
    int diff = (int)pcm - *predictor;
    uint8_t code = 0;
    if (diff < 0) { code = 8; diff = -diff; }
    int step = step_table[*step_index];
    int delta = step >> 3;
    if (diff >= step) {
        code |= 4;
        diff -= step;
        delta += step;
    }
    if (diff >= (step >> 1)) {
        code |= 2;
        diff -= step >> 1;
        delta += step >> 1;
    }
    if (diff >= (step >> 2)) {
        code |= 1;
        delta += step >> 2;
    }
    *predictor += (code & 8) ? -delta : delta;
    if (*predictor > 32767) { *predictor = 32767; }
    if (*predictor < -32768) { *predictor = -32768; }
    *step_index += index_delta[code & 7];
    if (*step_index < 0) { *step_index = 0; }
    if (*step_index > 88) { *step_index = 88; }
    return code;
}

static void submit_frame(const int16_t *samples) {
    if (!tx_queue || !is_connected || !subscribed || negotiated_mtu < (HITEL_PACKET_BYTES + 3)) {
        return;
    }
    hitel_packet_t packet = {0};
    packet.bytes[0] = 0x48;
    packet.bytes[1] = 1; // version
    packet.bytes[2] = 1; // self-contained IMA ADPCM
    packet.bytes[3] = 0;
    packet.bytes[4] = (uint8_t)(sequence_id & 0xff);
    packet.bytes[5] = (uint8_t)(sequence_id >> 8);
    sequence_id++;
    const int16_t initial = samples[0];
    packet.bytes[6] = (uint8_t)(initial & 0xff);
    packet.bytes[7] = (uint8_t)(((uint16_t)initial) >> 8);
    packet.bytes[8] = 0; // IMA step index reset for every packet
    packet.bytes[9] = 0;
    int predictor = initial;
    int index = 0;
    for (int i = 0; i < HITEL_SAMPLES_PER_PACKET; i += 2) {
        uint8_t a = encode_ima_sample(samples[i], &predictor, &index);
        uint8_t b = encode_ima_sample(samples[i + 1], &predictor, &index);
        packet.bytes[10 + i / 2] = a | (uint8_t)(b << 4);
    }
    // No blocking on Bluetooth audio callback. A full queue drops the packet
    // and the receiver's sequence counter reports the loss.
    (void)xQueueSend(tx_queue, &packet, 0);
}

void hitel_ble_submit_pcm8k(const uint8_t *bytes, size_t count) {
    if (!bytes || count < 2) { return; }
    // This function receives PCM16 little-endian at 8000 samples/sec.
    // ESP-IDF HFP vHCI without external codec provides decoded PCM.
    for (size_t pos = 0; pos + 1 < count; pos += 2) {
        int16_t value = (int16_t)((uint16_t)bytes[pos] | ((uint16_t)bytes[pos + 1] << 8));
        pending_pcm[pending_length++] = value;
        if (pending_length == HITEL_SAMPLES_PER_PACKET) {
            submit_frame(pending_pcm);
            pending_length = 0;
        }
    }
}

static esp_ble_adv_params_t adv_params = {
    .adv_int_min = 0x40,
    .adv_int_max = 0x80,
    .adv_type = ADV_TYPE_IND,
    .own_addr_type = BLE_ADDR_TYPE_PUBLIC,
    .channel_map = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};
static esp_ble_adv_data_t adv_data = {
    .set_scan_rsp = false,
    .include_name = false,
    .include_txpower = false,
    .min_interval = 0x20,
    .max_interval = 0x40,
    .appearance = 0,
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = sizeof(SERVICE_UUID),
    .p_service_uuid = (uint8_t *)SERVICE_UUID,
    .flag = ESP_BLE_ADV_FLAG_GEN_DISC,
};

static void gap_event(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param) {
    (void)param;
    if (event == ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT) {
        esp_ble_gap_start_advertising(&adv_params);
    }
}

static void gatts_event(esp_gatts_cb_event_t event,
                        esp_gatt_if_t interface,
                        esp_ble_gatts_cb_param_t *param) {
    switch (event) {
    case ESP_GATTS_REG_EVT: {
        gatts_if = interface;
        esp_gatt_srvc_id_t service_id = {0};
        service_id.is_primary = true;
        service_id.id.inst_id = 0;
        service_id.id.uuid.len = ESP_UUID_LEN_128;
        memcpy(service_id.id.uuid.uuid.uuid128, SERVICE_UUID, 16);
        esp_ble_gatts_create_service(interface, &service_id, 6);
        esp_ble_gap_set_device_name("HITEL-HFP-AUDIO");
        esp_ble_gap_config_adv_data(&adv_data);
        break;
    }
    case ESP_GATTS_CREATE_EVT: {
        service_handle = param->create.service_handle;
        esp_ble_gatts_start_service(service_handle);
        esp_bt_uuid_t uuid = {.len = ESP_UUID_LEN_128};
        memcpy(uuid.uuid.uuid128, AUDIO_UUID, 16);
        static uint8_t initial_value = 0;
        esp_attr_value_t val = {
            .attr_max_len = 185, .attr_len = 1, .attr_value = &initial_value
        };
        esp_ble_gatts_add_char(service_handle, &uuid, ESP_GATT_PERM_READ_ENCRYPTED,
                               ESP_GATT_CHAR_PROP_BIT_NOTIFY | ESP_GATT_CHAR_PROP_BIT_READ,
                               &val, NULL);
        break;
    }
    case ESP_GATTS_ADD_CHAR_EVT: {
        char_handle = param->add_char.attr_handle;
        esp_bt_uuid_t uuid = {.len = ESP_UUID_LEN_16};
        uuid.uuid.uuid16 = ESP_GATT_UUID_CHAR_CLIENT_CONFIG;
        static uint8_t ccc_initial[2] = {0,0};
        esp_attr_value_t val = {
            .attr_max_len = 2, .attr_len = 2, .attr_value = ccc_initial
        };
        esp_ble_gatts_add_char_descr(service_handle, &uuid,
                                     ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED,
                                     &val, NULL);
        break;
    }
    case ESP_GATTS_ADD_CHAR_DESCR_EVT:
        ccc_handle = param->add_char_descr.attr_handle;
        break;
    case ESP_GATTS_CONNECT_EVT:
        is_connected = true;
        subscribed = false;
        conn_id = param->connect.conn_id;
        negotiated_mtu = 23;
        sequence_id = 0;
        pending_length = 0;
        break;
    case ESP_GATTS_MTU_EVT:
        negotiated_mtu = param->mtu.mtu;
        ESP_LOGI(TAG, "BLE MTU=%u; minimum required=93", negotiated_mtu);
        break;
    case ESP_GATTS_WRITE_EVT:
        if (param->write.handle == ccc_handle && param->write.len == 2) {
            subscribed = (param->write.value[0] & 1) != 0;
            ESP_LOGI(TAG, "HITEL audio subscribe=%u", (unsigned)subscribed);
        }
        if (param->write.need_rsp) {
            esp_ble_gatts_send_response(interface, param->write.conn_id,
                                        param->write.trans_id, ESP_GATT_OK, NULL);
        }
        break;
    case ESP_GATTS_DISCONNECT_EVT:
        is_connected = false;
        subscribed = false;
        negotiated_mtu = 23;
        esp_ble_gap_start_advertising(&adv_params);
        break;
    default:
        break;
    }
}

static void ble_send_task(void *arg) {
    (void)arg;
    hitel_packet_t frame;
    while (1) {
        if (xQueueReceive(tx_queue, &frame, portMAX_DELAY) != pdTRUE) { continue; }
        if (!subscribed || !is_connected || !char_handle || negotiated_mtu < 93) { continue; }
        esp_err_t err = esp_ble_gatts_send_indicate(
            gatts_if, conn_id, char_handle, HITEL_PACKET_BYTES, frame.bytes, false);
        if (err != ESP_OK) {
            ESP_LOGD(TAG, "BLE notify error=%d (no fabricated frame acknowledgement)", (int)err);
        }
    }
}

esp_err_t hitel_ble_init(void) {
    if (tx_queue) { return ESP_OK; }
    tx_queue = xQueueCreate(HITEL_QUEUE_DEPTH, sizeof(hitel_packet_t));
    if (!tx_queue) { return ESP_ERR_NO_MEM; }
    if (xTaskCreate(ble_send_task, "hitel_ble_audio", 4096, NULL, 5, NULL) != pdPASS) {
        vQueueDelete(tx_queue);
        tx_queue = NULL;
        return ESP_ERR_NO_MEM;
    }
    // Secure Connections bonding encrypts GATT audio notifications after
    // a user-approved pairing. No unencrypted call audio GATT subscription.
    esp_ble_auth_req_t auth = ESP_LE_AUTH_REQ_SC_BOND;
    esp_ble_io_cap_t io_cap = ESP_IO_CAP_NONE;
    uint8_t key_size = 16;
    ESP_ERROR_CHECK(esp_ble_gap_set_security_param(ESP_BLE_SM_AUTHEN_REQ_MODE, &auth, sizeof(auth)));
    ESP_ERROR_CHECK(esp_ble_gap_set_security_param(ESP_BLE_SM_IOCAP_MODE, &io_cap, sizeof(io_cap)));
    ESP_ERROR_CHECK(esp_ble_gap_set_security_param(ESP_BLE_SM_MAX_KEY_SIZE, &key_size, sizeof(key_size)));
    ESP_ERROR_CHECK(esp_ble_gatt_set_local_mtu(185));
    ESP_ERROR_CHECK(esp_ble_gap_register_callback(gap_event));
    ESP_ERROR_CHECK(esp_ble_gatts_register_callback(gatts_event));
    ESP_ERROR_CHECK(esp_ble_gatts_app_register(HITEL_GATT_APP_ID));
    ESP_LOGI(TAG, "HFP downlink BLE codec ready; waiting for actual HFP PCM");
    return ESP_OK;
}
