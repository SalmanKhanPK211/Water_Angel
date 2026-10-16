import os
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# SUPABASE / LOVABLE ML GATEWAY CONFIGURATION
# ============================================================
ML_GATEWAY_URL = os.environ.get("ML_GATEWAY_URL", "https://pucmngrhhrzybuucrhuk.supabase.co/functions/v1/ml-gateway")
X_API_TOKEN = os.environ.get("X_API_TOKEN", "2c64e922a51582a407793f24a532bcfda75d1d6b137adcb038a30fcd8eea1a97")

HEADERS = {
    "X-API-Token": X_API_TOKEN,
    "Content-Type": "application/json"
}

# ============================================================
# TARGET DEFINITIONS (Single 1-Figure Weekly Forecast)
# ============================================================
FORECAST_HORIZON_DAYS = 7
PREDICTION_TYPE = "weekly_consumption"
DEFAULT_MODEL_VERSION = "ensemble-weekly-v1"

# ============================================================
# ENGINEERED FEATURE DEFINITIONS
# ============================================================
FEATURES = [
    # Calendar & Cyclical Features
    "day_of_week",
    "is_weekend",
    "month",
    "day_of_year",

    # Weekly Aggregated Lags (Most powerful predictors for 7-day total)
    "past_7d_liters",
    "past_7d_lag7",
    "past_7d_lag14",

    # Weekly Consumption Momentum & Differences
    "diff_7_14",
    "diff_14_21",

    # Daily Lags (Short-term memory)
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_7",

    # Rolling Windows
    "rolling_mean_7",
    "rolling_std_7",
    "rolling_mean_14",
    "rolling_mean_30",

    # Trend Indicators
    "trend_ratio_7_30"
]

# Minimum days of history required to fit models and generate features
MIN_HISTORICAL_DAYS = 21

# Test holdout size in days for cross-validation benchmark
BENCHMARK_TEST_DAYS = 30
