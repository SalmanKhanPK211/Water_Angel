import os
import requests
from dotenv import load_dotenv

load_dotenv()

GATEWAY_URL = os.environ.get("ML_GATEWAY_URL")
TOKEN = os.environ.get("X_API_TOKEN")

headers = {
    "X-API-Token": TOKEN,
    "Content-Type": "application/json"
}

# Test 1: Fetch devices
print("📖 Testing GET /api/devices...")
resp = requests.get(f"{GATEWAY_URL}/api/devices", headers=headers)
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    print(resp.json())
else:
    print(resp.text)

# Test 2: Fetch daily usage for a specific device (use a real device ID if you have one)
print("\nTesting GET /api/daily-usage/{deviceId}...")
# Replace with a real device ID from the response above, or use the dummy ID
device_id = "bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb"  # Update this
resp = requests.get(f"{GATEWAY_URL}/api/daily-usage/{device_id}?days=10", headers=headers)
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"Device: {data.get('device_id')}")
    print(f"Rows: {len(data.get('data', []))}")
else:
    print(resp.text)

# Test 3: Store a test prediction
print("\nTesting POST /api/predictions...")
test_payload = [
    {
        "device_id": device_id,
        "target_date": "2025-09-10",
        "predicted_value": 80.5
    }
]
resp = requests.post(f"{GATEWAY_URL}/api/predictions", headers=headers, json=test_payload)
print(f"Status: {resp.status_code}")
print(resp.text)