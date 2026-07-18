Version 2: Offline Capability and Local Persistence
Version 2 focuses on making the device more resilient to internet outages and improving user alerts.
Offline-Ready Logic: The firmware is redesigned to work fully offline, making WiFi optional
.
EEPROM Expansion & Local Storage: EEPROM size was increased to 256 bytes to store critical settings locally, including tank height and pump thresholds (upper, lower, and critical)
. This ensures the device maintains its configuration without cloud access
.
Enhanced Alerting: Introduced a specific TDS critical threshold (600.0 ppm) and distinct buzzer patterns for critical alarms
.
Improved WiFi Handling: Connection attempts are now "non-blocking-ish" with a 10-second timeout, preventing the device from hanging if WiFi is unavailable
.