Version 3: Non-Blocking Execution and Performance Fixes
Version 3 addresses stability issues and introduces "offline-first" architectural improvements.
Non-Blocking State Machines: Both the WiFi connection and the buzzer (beeps) were converted to non-blocking state machines
. This prevents the main sensor loop from freezing while waiting for a connection or during a beep sequence
.
HTTPS Stability: Replaced basic HTTP calls with a more robust WiFiClientSecure implementation, using a "fresh socket" approach for every request to avoid TLS reuse bugs
.
Pump Runtime Tracking: Added logic to track and report the total pump runtime (in minutes) to the cloud, providing data on water usage or pump health
.
Manual Overrides: Improved "MANUAL" mode to allow the cloud to directly command the pump status (ON/OFF)
.