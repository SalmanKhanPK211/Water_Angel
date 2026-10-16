import requests
from typing import List, Dict, Any
from config import ML_GATEWAY_URL, HEADERS

def publish_weekly_predictions(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Submits weekly forecast predictions to the Supabase ml-gateway Edge Function.
    
    The ml-gateway will validate:
        - device_id (UUID)
        - target_date (YYYY-MM-DD)
        - predicted_value (number in litres)
        - prediction_type ('weekly_consumption')
        - model_version
        - confidence
        - metadata (JSON with week_start, week_end, unit)
    and insert into the public.ml_predictions table.
    """
    if not records:
        return {"status": "skipped", "message": "No records to publish"}

    url = f"{ML_GATEWAY_URL}/api/predictions"

    payload = []
    for r in records:
        payload.append({
            "device_id": r["device_id"],
            "target_date": r["target_date"],
            "predicted_value": float(r["predicted_value"]),
            "prediction_type": r.get("prediction_type", "weekly_consumption"),
            "model_version": r.get("model_version", "ensemble-weekly-v1"),
            "confidence": float(r.get("confidence", 0.9)),
            "metadata": r.get("metadata", {})
        })

    print(f"[DB PUBLISHER] Sending {len(payload)} weekly prediction(s) to {url}...")
    resp = requests.post(url, headers=HEADERS, json=payload, timeout=20)
    resp.raise_for_status()

    result = resp.json()
    print(f"[DB PUBLISHER] [OK] Successfully saved to ml_predictions: {result}")
    return result
