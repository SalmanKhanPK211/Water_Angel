import requests
from datetime import datetime, timedelta
from config import ML_GATEWAY_URL, HEADERS

def store_predictions(device_id: str, predictions: list, weekly_total: float):
    """
    Send 7-day predictions to Lovable Gateway.
    Lovable's endpoint automatically deletes old daily_consumption rows for this device.
    """
    today = datetime.now().date()
    rows = []
    for i, val in enumerate(predictions):
        target_date = today + timedelta(days=i+1)
        rows.append({
            "device_id": device_id,
            "target_date": target_date.isoformat(),
            "predicted_value": float(val)   #  Convert numpy.float32 to Python float
        })

    url = f"{ML_GATEWAY_URL}/api/predictions"
    resp = requests.post(url, headers=HEADERS, json=rows)
    resp.raise_for_status()
    
    print(f"Inserted {len(rows)} predictions for device {device_id}")