import os
from dotenv import load_dotenv

load_dotenv()

# Lovable ML Gateway Configuration
ML_GATEWAY_URL = os.environ.get("ML_GATEWAY_URL")
X_API_TOKEN = os.environ.get("X_API_TOKEN")

# Headers for all requests to the Lovable Gateway
HEADERS = {
    "X-API-Token": X_API_TOKEN,
    "Content-Type": "application/json"
}

# Feature columns used for XGBoost (must match feature_engineering.py)
FEATURES = [
    'day_of_week', 'is_weekend', 'month', 'quarter', 'day_of_year', 'week_of_year',
    'trend_ratio', 'ratio_to_weekday_avg',
    'lag_1', 'lag_2', 'lag_3', 'lag_7', 'lag_14', 'lag_21',
    'rolling_mean_7', 'rolling_std_7', 'rolling_mean_30',
    'readings_count'
]

MODEL_VERSION = "xgb-v1"