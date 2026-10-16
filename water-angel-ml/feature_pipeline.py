import pandas as pd
import numpy as np
from typing import Tuple, Optional
from config import FEATURES, FORECAST_HORIZON_DAYS

def engineer_weekly_features(df: pd.DataFrame, is_training: bool = True) -> pd.DataFrame:
    """
    Transforms daily water consumption time-series into weekly forecasting features.
    
    If is_training is True:
        Computes 'target_weekly_liters' representing the total volumetric consumption 
        in the upcoming 7-day horizon (t+1 through t+7).
    """
    if df.empty or len(df) < 14:
        return pd.DataFrame()

    df = df.sort_values(["device_id", "usage_date"]).reset_index(drop=True)
    processed_groups = []

    for device_id, group in df.groupby("device_id"):
        group = group.sort_values("usage_date").reset_index(drop=True).copy()

        # 1. Outlier clipping (1st - 99th percentile) to prevent sensor glitches from skewing models
        q_low = group["liters_used"].quantile(0.01)
        q_high = group["liters_used"].quantile(0.99)
        group["liters_clean"] = group["liters_used"].clip(q_low, q_high)

        # 2. Ground Truth Target (Only for training historical dates)
        # target_weekly_liters is the sum of consumption for the NEXT 7 days
        group["target_weekly_liters"] = (
            group["liters_clean"].rolling(FORECAST_HORIZON_DAYS).sum().shift(-FORECAST_HORIZON_DAYS)
        )

        # 3. Calendar & Cyclical Features
        group["day_of_week"] = group["usage_date"].dt.dayofweek
        group["is_weekend"] = (group["day_of_week"] >= 5).astype(int)
        group["month"] = group["usage_date"].dt.month
        group["day_of_year"] = group["usage_date"].dt.dayofyear

        # 4. Weekly Aggregates (Most critical signal for 7-day volume forecasting)
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

        # 7. Rolling Statistics
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

def prepare_training_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Prepares X feature matrix and y target vector for training by dropping rows 
    with missing history or unobservable future targets.
    """
    featured = engineer_weekly_features(df, is_training=True)
    if featured.empty:
        return pd.DataFrame(), pd.Series()

    # Drop rows that do not have full feature history or future targets
    valid = featured.dropna(subset=FEATURES + ["target_weekly_liters"]).reset_index(drop=True)
    X = valid[FEATURES]
    y = valid["target_weekly_liters"]
    return X, y

def prepare_inference_features(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    """
    Extracts the feature vector from the most recent available date to forecast 
    the upcoming week. Does NOT require future target_weekly_liters to be known.
    """
    featured = engineer_weekly_features(df, is_training=False)
    if featured.empty:
        return None

    # Filter to rows having all required input features
    valid = featured.dropna(subset=FEATURES)
    if valid.empty:
        return None

    # Take the latest available row for inference
    latest_row = valid.iloc[-1:][FEATURES]
    return latest_row
