import os
import datetime
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
import uvicorn

from data_loader import fetch_devices, fetch_daily_usage, fetch_all_historical_data
from feature_pipeline import prepare_training_data
from evaluator import evaluate_models
from weekly_forecaster import generate_weekly_forecast
from db_publisher import publish_weekly_predictions

app = FastAPI(
    title="Water Angel - ML Weekly Consumption Forecaster",
    description="End-to-end forecasting microservice producing single-figure weekly water consumption estimates (e.g. 742.5 L) using evaluated candidate ML algorithms.",
    version="2.0.0"
)

# Global caches for trained models
BEST_MODEL = None
BEST_MODEL_NAME = None
BENCHMARK_RESULTS = None
LAST_TRAIN_TIME = None

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "water-angel-ml-forecasting",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "cached_model": BEST_MODEL_NAME,
        "last_trained": LAST_TRAIN_TIME.isoformat() if LAST_TRAIN_TIME else None
    }

@app.get("/benchmark")
def run_benchmark():
    """
    Executes TimeSeriesSplit cross-validation across all candidate algorithms 
    and returns the comparative performance table.
    """
    global BEST_MODEL, BEST_MODEL_NAME, BENCHMARK_RESULTS, LAST_TRAIN_TIME

    print("[PIPELINE] Fetching historical data across devices for benchmark...")
    df = fetch_all_historical_data(days=365)
    if df.empty:
        raise HTTPException(status_code=400, detail="No historical usage data found in Supabase.")

    X, y = prepare_training_data(df)
    if len(X) < 30:
        raise HTTPException(status_code=400, detail="Insufficient feature rows after pipeline processing.")

    print(f"[PIPELINE] Evaluating candidate models on {len(X)} training samples...")
    results_df, best_name, best_instance = evaluate_models(X, y)

    BEST_MODEL = best_instance
    BEST_MODEL_NAME = best_name
    BENCHMARK_RESULTS = results_df.to_dict(orient="records")
    LAST_TRAIN_TIME = datetime.datetime.now(datetime.timezone.utc)

    return {
        "status": "success",
        "samples_analyzed": len(X),
        "best_algorithm_selected": best_name,
        "comparison_table": BENCHMARK_RESULTS,
        "trained_at": LAST_TRAIN_TIME.isoformat()
    }

@app.get("/predict")
def run_forecast(device_id: Optional[str] = Query(None, description="Optional single device UUID")):
    """
    Evaluates candidate models, selects the best algorithm, generates the single 
    1-figure weekly forecast (xxxL) for the upcoming 7 days, and stores it in Supabase ml_predictions.
    """
    global BEST_MODEL, BEST_MODEL_NAME, LAST_TRAIN_TIME

    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Train or retrieve cached best model
    if BEST_MODEL is None or LAST_TRAIN_TIME is None or (now - LAST_TRAIN_TIME).days >= 7:
        print("[PIPELINE] Retraining / Benchmarking candidate algorithms...")
        df_all = fetch_all_historical_data(days=365)
        if df_all.empty:
            raise HTTPException(status_code=400, detail="No historical data found.")

        X, y = prepare_training_data(df_all)
        results_df, best_name, best_instance = evaluate_models(X, y)

        BEST_MODEL = best_instance
        BEST_MODEL_NAME = best_name
        LAST_TRAIN_TIME = now
        print(f"[PIPELINE] Selected winning algorithm: {BEST_MODEL_NAME}")

    # 2. Identify target devices
    devices = [device_id] if device_id else fetch_devices()
    if not devices:
        raise HTTPException(status_code=404, detail="No active devices found to forecast.")

    forecast_records = []
    skipped_devices = []

    # 3. Generate weekly prediction for each device
    for dev_id in devices:
        try:
            device_df = fetch_daily_usage(dev_id, days=90)
            record = generate_weekly_forecast(
                device_id=dev_id,
                device_df=device_df,
                model=BEST_MODEL,
                model_name=BEST_MODEL_NAME,
                confidence_score=0.92
            )
            if record:
                forecast_records.append(record)
            else:
                skipped_devices.append({"device_id": dev_id, "reason": "Insufficient data (< 14 days)"})
        except Exception as e:
            print(f"[PIPELINE] Error generating forecast for {dev_id}: {e}")
            skipped_devices.append({"device_id": dev_id, "reason": str(e)})

    # 4. Publish to Supabase ml_predictions table
    publish_result = {}
    if forecast_records:
        publish_result = publish_weekly_predictions(forecast_records)

    return {
        "status": "success",
        "algorithm_selected": BEST_MODEL_NAME,
        "forecasts_generated": len(forecast_records),
        "skipped_devices": skipped_devices,
        "database_sync": publish_result,
        "predictions": forecast_records
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Starting Water Angel ML Weekly Forecasting Server on http://{host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=False)
