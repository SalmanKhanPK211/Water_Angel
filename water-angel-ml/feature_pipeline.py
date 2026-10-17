import pandas as pd
import numpy as np
from typing import Tuple, Optional, Dict
from config import FEATURES, FORECAST_HORIZON_DAYS

def compute_clipping_bounds(df: pd.DataFrame) -> Dict[str, Tuple[float, float]]:
    """
    Computes 1st and 99th percentile outlier bounds per device STRICTLY on 
    historical training data to prevent future distribution leakage.
    """
    bounds = {}
    if df.empty or "device_id" not in df.columns or "liters_used" not in df.columns:
        return bounds

    for device_id, group in df.groupby("device_id"):
        q_low = float(group["liters_used"].quantile(0.01))
        q_high = float(group["liters_used"].quantile(0.99))
        bounds[device_id] = (q_low, q_high)
    return bounds

def engineer_weekly_features(
    df: pd.DataFrame, 
    is_training: bool = True,
    clipping_bounds: Optional[Dict[str, Tuple[float, float]]] = None
) -> pd.DataFrame:
    """
    Transforms daily water consumption time-series into weekly forecasting features.
    
    Leak-Free Guarantees:
    - Outlier clipping bounds are applied from training-fitted parameters.
    - All features at index t are strictly causal (lagged or trailing windows <= t).
    - If is_training=True: computes 'target_weekly_liters' representing the forward 
      7-day cumulative consumption (t+1 through t+7).
    """
    if df.empty or len(df) < 14:
        return pd.DataFrame()

    df = df.sort_values(["device_id", "usage_date"]).reset_index(drop=True)
    processed_groups = []

    for device_id, group in df.groupby("device_id"):
        group = group.sort_values("usage_date").reset_index(drop=True).copy()

        # 1. Outlier clipping using training-fitted bounds (or fallback to local group if none provided)
        if clipping_bounds and device_id in clipping_bounds:
            q_low, q_high = clipping_bounds[device_id]
        else:
            q_low = float(group["liters_used"].quantile(0.01))
            q_high = float(group["liters_used"].quantile(0.99))

        group["liters_clean"] = group["liters_used"].clip(q_low, q_high)

        # 2. Ground Truth Target (Only for training/evaluation dates)
        # target_weekly_liters is the sum of consumption for the NEXT 7 days (t+1 to t+7)
        if is_training:
            group["target_weekly_liters"] = (
                group["liters_clean"].rolling(FORECAST_HORIZON_DAYS).sum().shift(-FORECAST_HORIZON_DAYS)
            )

        # 3. Calendar & Cyclical Features (Known at observation time t)
        group["day_of_week"] = group["usage_date"].dt.dayofweek
        group["is_weekend"] = (group["day_of_week"] >= 5).astype(int)
        group["month"] = group["usage_date"].dt.month
        group["day_of_year"] = group["usage_date"].dt.dayofyear

        # 4. Weekly Aggregates (Trailing sum through day t)
        group["past_7d_liters"] = group["liters_clean"].rolling(7).sum()
        group["past_7d_lag7"] = group["past_7d_liters"].shift(7)
        group["past_7d_lag14"] = group["past_7d_liters"].shift(14)

        # 5. Weekly Consumption Momentum (Trend velocity)
        group["diff_7_14"] = group["past_7d_liters"] - group["past_7d_lag7"]
        group["diff_14_21"] = group["past_7d_lag7"] - group["past_7d_lag14"]

        # 6. Daily Lags (Short-term dynamics)
        group["lag_1"] = group["liters_clean"].shift(1)
        group["lag_2"] = group["liters_clean"].shift(2)
        group["lag_3"] = group["liters_clean"].shift(3)
        group["lag_7"] = group["liters_clean"].shift(7)

        # 7. Trailing Rolling Statistics (Through day t)
        group["rolling_mean_7"] = group["liters_clean"].rolling(7).mean()
        group["rolling_std_7"] = group["liters_clean"].rolling(7).std().fillna(0)
        group["rolling_mean_14"] = group["liters_clean"].rolling(14).mean()
        group["rolling_mean_30"] = group["liters_clean"].rolling(30).mean()

        # 8. Momentum Ratio
        group["trend_ratio_7_30"] = (
            group["rolling_mean_7"] / group["rolling_mean_30"].replace(0, np.nan)
        ).fillna(1.0)

        processed_groups.append(group)

    if not processed_groups:
        return pd.DataFrame()

    full_df = pd.concat(processed_groups, ignore_index=True)
    return full_df

def split_train_test_chronological(
    df: pd.DataFrame, 
    test_days: int = 30, 
    forecast_horizon: int = FORECAST_HORIZON_DAYS
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Tuple[float, float]]]:
    """
    Splits multi-device panel telemetry into strictly leak-free training and holdout test partitions:
    
    Leak-Free Guarantees Enforced:
    1. Chronological Date-Based Split: All devices are partitioned by calendar date simultaneously.
    2. Purging & Embargo Gap: An embargo gap of (forecast_horizon + 1) days is removed from the end of 
       the training set. This ensures NO training sample's 7-day forward target reaches into the test period.
    3. Train-Only Preprocessing: Outlier clipping thresholds are computed strictly on the training partition.
    """
    if df.empty:
        return pd.DataFrame(), pd.DataFrame(), {}

    max_date = df["usage_date"].max()
    test_cutoff = max_date - pd.Timedelta(days=test_days)
    # Embargo purge gap: 8 days prior to test_cutoff
    purge_cutoff = test_cutoff - pd.Timedelta(days=forecast_horizon + 1)

    # Compute outlier bounds strictly on historical training rows
    train_raw = df[df["usage_date"] <= purge_cutoff]
    clipping_bounds = compute_clipping_bounds(train_raw)

    # Feature engineering applied with learned training bounds
    featured = engineer_weekly_features(df, is_training=True, clipping_bounds=clipping_bounds)

    # Partition chronologically with strict zero-leakage boundaries
    train_df = featured[featured["usage_date"] <= purge_cutoff].dropna(
        subset=FEATURES + ["target_weekly_liters"]
    ).reset_index(drop=True)

    test_df = featured[featured["usage_date"] >= test_cutoff].dropna(
        subset=FEATURES + ["target_weekly_liters"]
    ).reset_index(drop=True)

    return train_df, test_df, clipping_bounds

def prepare_training_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Prepares full training feature matrix X and target vector y for final model fitting.
    """
    clipping_bounds = compute_clipping_bounds(df)
    featured = engineer_weekly_features(df, is_training=True, clipping_bounds=clipping_bounds)
    if featured.empty:
        return pd.DataFrame(), pd.Series()

    valid = featured.dropna(subset=FEATURES + ["target_weekly_liters"]).reset_index(drop=True)
    X = valid[FEATURES]
    y = valid["target_weekly_liters"]
    return X, y

def prepare_inference_features(
    df: pd.DataFrame, 
    clipping_bounds: Optional[Dict[str, Tuple[float, float]]] = None
) -> Optional[pd.DataFrame]:
    """
    Extracts the feature vector from the most recent available date to forecast 
    the upcoming week. Does NOT require future target_weekly_liters to be known.
    """
    featured = engineer_weekly_features(df, is_training=False, clipping_bounds=clipping_bounds)
    if featured.empty:
        return None

    valid = featured.dropna(subset=FEATURES)
    if valid.empty:
        return None

    # Take the latest available row for inference
    latest_row = valid.iloc[-1:][FEATURES]
    return latest_row
