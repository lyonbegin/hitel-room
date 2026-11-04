#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HijelHID_BLEMouse.h>

// HITEL iPhone XR carrier-call UI input proof of concept.
// An external ESP32 is necessary: iOS apps cannot inject system-wide taps.
// Bluetooth pairing + AssistiveTouch are required once on the iPhone.
// This firmware does not know whether a call is being recorded.
static const char *kApSsid = "HITEL-TAP";
static const char *kApPassword = "HitelTap2026"; // Change before non-lab use.
static const int kDefaultX = 60; // Relative mouse units from top-left corner, NOT iPhone points.
static const int kDefaultY = 120;

HijelBLEMouse bleMouse("HITEL Tap Mouse", "HITEL");
WebServer web(80);
String lastCallToken = "";
uint32_t lastTapMillis = 0;
unsigned long commandCount = 0;

static void replyJSON(int code, const String &payload) {
  web.sendHeader("Cache-Control", "no-store");
  web.send(code, "application/json; charset=utf-8", payload);
}

static int clampArg(const char *name, int fallback, int minValue, int maxValue) {
  if (!web.hasArg(name)) return fallback;
  return constrain(web.arg(name).toInt(), minValue, maxValue);
}

static void rehomePointer(int x, int y) {
  // Human pointer position is unknown. First overrun the top-left boundary.
  // HID reports use relative deltas; iOS acceleration makes calibration necessary.
  bleMouse.moveTo(-3200, -3200, 500);
  delay(180);
  bleMouse.moveTo(x, y, 270);
  delay(180);
}

void onStatus() {
  replyJSON(200, String("{\"ok\":true,\"device\":\"HITEL Tap Mouse\",") +
       "\"blePaired\":" + (bleMouse.isPaired() ? "true" : "false") +
       ",\"wifiClients\":" + String(WiFi.softAPgetStationNum()) +
       ",\"commandCount\":" + String(commandCount) +
       ",\"recordingConfirmed\":false}");
}

void onMove() {
  if (!bleMouse.isPaired()) {
    replyJSON(409, "{\"ok\":false,\"error\":\"bluetooth_not_paired\"}");
    return;
  }
  int x = clampArg("x", kDefaultX, 0, 750);
  int y = clampArg("y", kDefaultY, 0, 1200);
  rehomePointer(x, y); // Moves only; safe calibration.
  commandCount++;
  replyJSON(200, "{\"ok\":true,\"pointerMoved\":true,\"clicked\":false}");
}

void onTap() {
  if (!bleMouse.isPaired()) {
    replyJSON(409, "{\"ok\":false,\"error\":\"bluetooth_not_paired\"}");
    return;
  }
  if (!web.hasArg("call") || web.arg("call").length() < 8) {
    replyJSON(400, "{\"ok\":false,\"error\":\"missing_call_uuid\"}");
    return;
  }
  const String callToken = web.arg("call");
  if (callToken == lastCallToken) {
    replyJSON(409, "{\"ok\":false,\"error\":\"duplicate_call_prevented\"}");
    return;
  }
  if (lastTapMillis && millis() - lastTapMillis < 4000) {
    replyJSON(429, "{\"ok\":false,\"error\":\"tap_rate_limited\"}");
    return;
  }
  const int x = clampArg("x", kDefaultX, 0, 750);
  const int y = clampArg("y", kDefaultY, 0, 1200);

  rehomePointer(x, y);
  bleMouse.click(MouseButton::Left, 55);
  lastTapMillis = millis();
  lastCallToken = callToken;
  commandCount++;

  Serial.printf("HID mouse click sent for call token, x=%d, y=%d\n", x, y);
  // Even successful HID reports cannot establish Apple Phone's recording state.
  replyJSON(200, "{\"ok\":true,\"hidClickSent\":true,\"recordingConfirmed\":false}");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(kApSsid, kApPassword);
  Serial.printf("WiFi AP: %s / http://%s\n", kApSsid,
                WiFi.softAPIP().toString().c_str());
  bleMouse.begin();

  web.on("/status", HTTP_GET, onStatus);
  web.on("/move", HTTP_POST, onMove);
  web.on("/tap", HTTP_POST, onTap);
  web.onNotFound([]() {
    replyJSON(404, "{\"ok\":false,\"error\":\"not_found\"}");
  });
  web.begin();
  Serial.println("HITEL external BLE HID bridge ready");
}

void loop() {
  web.handleClient();
  delay(3);
}
