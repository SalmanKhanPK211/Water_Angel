import datetime
from datetime import timedelta
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional

from feature_pipeline import prepare_inference_features, prepare_training_data
from config import PREDICTION_TYPE, DEFAULT_MODEL_VERSION

def generate_weekly_forecast(
    device_id: str,
    device_df: pd.DataFrame,
    model: Any,
    model_name: str,
    confidence_score: float = 0.90
) -> Optional[Dict[str, Any]]:
    """
    Generates a single 1-figure weekly water consumption forecast (e.g. 742.5 L)
    for the upcoming 7-day period for a given device.
    
    Returns a dictionary conforming to the ml_predictions schema:
        - device_id
        - prediction_type ('weekly_consumption')
        - model_version
        - target_date (YYYY-MM-DD, start of week)
        - target_time (ISO string)
        - predicted_value (single float, liters for the coming week)
        - confidence (float between 0.0 and 1.0)
        - metadata (dict with week_start, week_end, daily_average_liters, etc.)
        - prediction_date (YYYY-MM-DD)
    """
    if device_df.empty or len(device_df) < 14:
        print(f"[FORECASTER] Insufficient data for device {device_id} (< 14 days)")
        return None

    inference_features = prepare_inference_features(device_df)
    if inference_features is None or inference_features.empty:
        print(f"[FORECASTER] Unable to construct inference features for {device_id}")
        return None

    # Predict the single weekly consumption figure (in litres)
    predicted_liters = float(model.predict(inference_features)[0])

    # Ensure non-negative and physically plausible forecast
    past_7d = float(inference_features["past_7d_liters"].values[0])
    if predicted_liters <= 0 or np.isnan(predicted_liters):
        predicted_liters = max(past_7d, 50.0)

    predicted_liters = round(predicted_liters, 1)
    daily_avg_liters = round(predicted_liters / 7.0, 1)

    today = datetime.datetime.now(datetime.timezone.utc).date()
    target_date = today + timedelta(days=1)  # Coming week starts tomorrow
    week_end = target_date + timedelta(days=6)

    # Derive version slug from model name
    version_slug = (
        "ensemble-weekly-v1" if "Ensemble" in model_name else
        "ridge-weekly-v1" if "Ridge" in model_name else
        "xgb-weekly-v1" if "XGBoost" in model_name else
        "rf-weekly-v1" if "Random Forest" in model_name else
        DEFAULT_MODEL_VERSION
    )

    record = {
        "device_id": device_id,
        "prediction_type": PREDICTION_TYPE,
        "model_version": version_slug,
        "target_date": target_date.isoformat(),
        "target_time": f"{target_date.isoformat()}T00:00:00Z",
        "predicted_value": predicted_liters,
        "confidence": round(float(confidence_score), 2),
        "prediction_date": today.isoformat(),
        "metadata": {
            "unit": "liters_per_week",
            "week_start": target_date.isoformat(),
            "week_end": week_end.isoformat(),
            "daily_average_liters": daily_avg_liters,
            "past_week_actual_liters": round(past_7d, 1),
            "algorithm_used": model_name
        }
    }

    return record
