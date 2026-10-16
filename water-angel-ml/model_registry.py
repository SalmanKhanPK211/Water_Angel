import numpy as np
import pandas as pd
from typing import Dict, Any
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, VotingRegressor
import xgboost as xgb

class PersistenceBaseline(BaseEstimator, RegressorMixin):
    """
    Empirical persistence baseline: forecasts that the next 7 days will 
    equal the water consumption of the past 7 days (past_7d_liters).
    """
    def __init__(self, feature_name: str = "past_7d_liters"):
        self.feature_name = feature_name

    def fit(self, X, y=None):
        return self

    def predict(self, X):
        if isinstance(X, pd.DataFrame):
            return X[self.feature_name].values
        return X[:, 4]  # index 4 corresponds to past_7d_liters in FEATURES

def get_candidate_models() -> Dict[str, Any]:
    """
    Returns a dictionary of all candidate ML models configured for weekly forecasting.
    """
    models = {
        "Baseline (Past Week Persistence)": PersistenceBaseline(),

        "Ridge Regularized Linear": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", Ridge(alpha=5.0, random_state=42))
        ]),

        "ElasticNet Regularized Linear": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", ElasticNet(alpha=0.5, l1_ratio=0.5, random_state=42))
        ]),

        "Random Forest Regressor": RandomForestRegressor(
            n_estimators=100,
            max_depth=5,
            min_samples_split=4,
            max_samples=0.8,
            random_state=42,
            n_jobs=-1
        ),

        "Gradient Boosting Regressor": GradientBoostingRegressor(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42
        ),

        "XGBoost Regressor (xgb-v1)": xgb.XGBRegressor(
            n_estimators=80,
            max_depth=3,
            learning_rate=0.05,
            reg_alpha=1.0,
            reg_lambda=1.0,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1
        ),
    }

    # Hybrid Ensemble combining linear scaling + gradient boosted non-linear trees
    models["Hybrid Weighted Ensemble (Ensemble-v1)"] = VotingRegressor([
        ("ridge", models["Ridge Regularized Linear"]),
        ("xgb", models["XGBoost Regressor (xgb-v1)"]),
        ("rf", models["Random Forest Regressor"])
    ])

    return models
