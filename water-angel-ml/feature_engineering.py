import pandas as pd
import numpy as np
from config import FEATURES

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Enhanced feature engineering for water consumption forecasting.
    Adds: weekday averages, outlier clipping, and trend normalization.
    """
    if df.empty:
        return df

    df = df.sort_values(['device_id', 'usage_date']).reset_index(drop=True)

    # --- 1. CALENDAR FEATURES (Same as before) ---
    df['day_of_week'] = df['usage_date'].dt.dayofweek
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    df['month'] = df['usage_date'].dt.month
    df['quarter'] = df['usage_date'].dt.quarter
    df['day_of_year'] = df['usage_date'].dt.dayofyear
    df['week_of_year'] = df['usage_date'].dt.isocalendar().week

    # --- 2. OUTLIER REMOVAL (Crucial new step) ---
    # We clip extreme values to prevent sensor glitches from confusing XGBoost.
    for device_id, group in df.groupby('device_id'):
        lower = group['liters_used'].quantile(0.01)  # 1st percentile
        upper = group['liters_used'].quantile(0.99)  # 99th percentile
        mask = (df['device_id'] == device_id)
        df.loc[mask, 'liters_used'] = df.loc[mask, 'liters_used'].clip(lower, upper)

    # --- 3. ADVANCED LAG & ROLLING FEATURES ---
    features = []
    for device_id, group in df.groupby('device_id'):
        group = group.sort_values('usage_date').copy()

        # Basic Lags
        group['lag_1'] = group['liters_used'].shift(1)
        group['lag_2'] = group['liters_used'].shift(2)
        group['lag_3'] = group['liters_used'].shift(3)
        group['lag_7'] = group['liters_used'].shift(7)
        group['lag_14'] = group['liters_used'].shift(14)
        group['lag_21'] = group['liters_used'].shift(21)  # 3 weeks ago

        # Rolling Stats (same as before)
        group['rolling_mean_7'] = group['liters_used'].rolling(7).mean()
        group['rolling_std_7'] = group['liters_used'].rolling(7).std()
        group['rolling_mean_30'] = group['liters_used'].rolling(30).mean()

        # --- 4. 🔥 NEW: "WEEKDAY PATTERN" FEATURES (STABILIZES THE SIGNAL) ---
        # This is the secret weapon: average of the same weekday over the last 4 weeks.
        # It filters out the noise of a single bad Monday by looking at all Mondays.
        group['avg_weekday_4w'] = group['liters_used'].rolling(28).apply(
            lambda x: x.iloc[[6, 13, 20, 27]].mean() if len(x) >= 28 else np.nan
        )
        
        # Normalize the current day's value against the average weekday pattern
        group['ratio_to_weekday_avg'] = group['liters_used'] / group['avg_weekday_4w']

        # --- 5. 🔥 TREND RATIO (Already there, but we keep it) ---
        group['trend_ratio'] = group['rolling_mean_7'] / group['rolling_mean_30']

        features.append(group)

    df = pd.concat(features, ignore_index=True)

    # Drop NaN rows (first 28 days will now be NaN due to the 4-week rolling average)
    df = df.dropna()

    # --- 6. FILTERING ---
    if 'readings_count' in df.columns:
        df = df[df['readings_count'] >= 5]

    return df

def get_x_y(df: pd.DataFrame):
    # Update FEATURES list to include the new columns
    # You must add these to config.py as well!
    X = df[FEATURES]
    y = df['liters_used']
    return X, y