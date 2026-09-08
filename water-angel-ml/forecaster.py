import pandas as pd
import numpy as np
from data_fetcher import fetch_daily_usage
from feature_engineering import engineer_features
from config import FEATURES

def predict_7_days(device_id: str, model):
    """Recursively forecast 7 days for a single device."""
    # Fetch last 60 days to have enough lags
    df = fetch_daily_usage(device_id, days=60)
    if len(df) < 14:
        raise ValueError(f"Device {device_id} has insufficient data (<14 days) for prediction.")

    # ✅ FIX: Inject the device_id column so engineer_features() can group by it
    df['device_id'] = device_id

    df = engineer_features(df)
    if df.empty:
        raise ValueError(f"Device {device_id} has no valid rows after feature engineering.")

    # Take the most recent row as starting point
    latest_row = df.iloc[-1:].copy()
    predictions = []
    current_row = latest_row.copy()

    for step in range(7):
        # Prepare features
        X_pred = current_row[FEATURES].values
        pred = model.predict(X_pred)[0]
        predictions.append(round(pred, 2))

        # Update for next day (recursive)
        new_row = current_row.copy()
        # Shift lags
        new_row['lag_3'] = current_row['lag_2'].values[0]
        new_row['lag_2'] = current_row['lag_1'].values[0]
        new_row['lag_1'] = pred

        # Approximate rolling statistics update
        old_mean = current_row['rolling_mean_7'].values[0]
        new_row['rolling_mean_7'] = (old_mean * 6 + pred) / 7

        # Approximate std deviation update
        old_std = current_row['rolling_std_7'].values[0]
        new_row['rolling_std_7'] = np.sqrt(((old_std**2) * 6 + (pred - old_mean)**2) / 7)

        # Update trend_ratio
        new_row['trend_ratio'] = new_row['rolling_mean_7'] / current_row['rolling_mean_30'].values[0]

        current_row = new_row

    weekly_total = round(sum(predictions), 2)
    return predictions, weekly_total