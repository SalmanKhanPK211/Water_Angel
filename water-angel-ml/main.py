import os
from datetime import datetime
from fastapi import FastAPI
import uvicorn

from data_fetcher import fetch_all_devices
from model_trainer import train_global_model
from forecaster import predict_7_days
from db_writer import store_predictions

app = FastAPI()

MODEL = None
LAST_TRAIN_DATE = None

@app.get("/predict")
def run_pipeline():
    global MODEL, LAST_TRAIN_DATE
    today = datetime.now().date()

    # Retrain weekly (every Sunday)
    if MODEL is None or LAST_TRAIN_DATE is None or (today - LAST_TRAIN_DATE).days >= 7:
        print("Training global model...")
        MODEL = train_global_model()
        LAST_TRAIN_DATE = today
        print("Model trained.")

    devices = fetch_all_devices()
    success_count = 0
    for dev_id in devices:
        try:
            preds, weekly = predict_7_days(dev_id, MODEL)
            store_predictions(dev_id, preds, weekly)
            success_count += 1
        except Exception as e:
            print(f"Skipped device {dev_id}: {e}")

    return {
        "status": "success",
        "devices_processed": success_count,
        "total_devices": len(devices),
        "model_version": "xgb-v1",
        "trained_on": LAST_TRAIN_DATE.isoformat()
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))