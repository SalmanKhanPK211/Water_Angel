# 💧 Water Angel — Machine Learning Weekly Consumption Forecasting

Production-grade, end-to-end machine learning forecasting pipeline for the Water Angel IoT ecosystem. Evaluates a competitive suite of candidate regression models to generate a single volumetric forecast (e.g. `742.5 L` for the upcoming week) and automatically updates the Supabase `ml_predictions` table.

---

## 📋 Table of Contents
- [1. Architecture & Design Changes](#1-architecture--design-changes)
- [2. Database Schema (`ml_predictions`)](#2-database-schema-ml_predictions)
- [3. Candidate Algorithms Documentation](#3-candidate-algorithms-documentation)
- [4. Benchmark Metrics & Comparison Table](#4-benchmark-metrics--comparison-table)
- [5. Feature Engineering](#5-feature-engineering)
- [6. Directory Structure](#6-directory-structure)
- [7. How to Run Locally & In Production](#7-how-to-run-locally--in-production)

---

## 1. Architecture & Design Changes

### Previous Legacy Architecture (Bugs & Bottlenecks)
1. **Day-by-Day Forecast Error Accumulation**: The previous pipeline recursively forecasted day $t+1, \dots, t+7$. Autoregressive step-by-step errors compounded exponentially across the 7-day horizon.
2. **Schema & Prediction Type Mismatch**: Sent individual rows without `"prediction_type": "daily_consumption"`, causing the gateway to default rows to `'weekly_consumption'` with `'prophet-v1'` tags.
3. **Static Calendar Features**: In the recursive loop, calendar features (`day_of_week`, `is_weekend`) failed to increment across steps.
4. **Encoding Crashes on Windows**: Unhandled UTF-8 characters crashed standard Windows console environments.

### New Architecture
- **Single 1-Figure Weekly Output**: Formulates weekly consumption directly:
  $$\hat{Y}_{\text{week}} = f(X_t) \approx \sum_{k=1}^{7} y_{t+k}$$
- **Direct Multi-Day Loss Optimization**: Models optimize directly for the 7-day volumetric sum instead of accumulating single-day variance.
- **Automated Algorithm Selection**: Evaluates 7 candidate models via chronological `TimeSeriesSplit(n_splits=5)` cross-validation and selects the highest-performing model dynamically.

---

## 2. Database Schema (`ml_predictions`)

The pipeline writes directly to the `public.ml_predictions` table via the `ml-gateway` Edge Function:

| Column | Data Type | Description | Example Value |
|---|---|---|---|
| `id` | `uuid` | Primary Key (auto-generated) | `24c525f8-67d6-41cf-af0f-9290cfb723f5` |
| `device_id` | `uuid` | Hardware unit identifier | `bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb` |
| `prediction_type` | `text` | Target prediction category | `weekly_consumption` |
| `model_version` | `text` | Version slug of the winning algorithm | `ensemble-weekly-v1` |
| `target_time` | `timestamptz` | ISO 8601 timestamp (start of week) | `2026-10-17T00:00:00Z` |
| `target_date` | `date` | Date string (start of week) | `2026-10-17` |
| `predicted_value` | `float8` | **Single 1-figure weekly volume (Litres)** | `1070.1` |
| `confidence` | `float8` | Statistical model confidence score (0.0 to 1.0) | `0.92` |
| `metadata` | `jsonb` | Contextual parameters & breakdown | `{"unit": "liters_per_week", "daily_average_liters": 152.9, "week_start": "2026-10-17", "week_end": "2026-10-23"}` |
| `created_at` | `timestamptz` | Timestamp when row was inserted | `2026-10-16 16:20:30+00` |
| `prediction_date` | `date` | Date the prediction was generated | `2026-10-16` |

---

## 3. Candidate Algorithms Documentation

We evaluated seven candidate regression models:

### 1. Baseline (Past Week Persistence)
- **Formulation**: $\hat{Y}_{t} = \sum_{i=0}^6 y_{t-i} = \text{past\_7d\_liters}_t$
- **Properties**: Zero-parameter empirical anchor. Household water demand has very strong weekly autocorrelation; households rarely change routines drastically from one week to the next.
- **Role**: Essential baseline that complex non-linear models must outperform.

### 2. ElasticNet Regularized Linear Regression
- **Formulation**: Minimizes $\frac{1}{2n}\|y - Xw\|_2^2 + \alpha \rho \|w\|_1 + \frac{\alpha(1-\rho)}{2} \|w\|_2^2$
- **Properties**: Blends L1 sparsity (feature selection) and L2 shrinkage (collinearity protection). Highly robust against multi-collinear lag features.

### 3. Gradient Boosting Regressor (sklearn)
- **Formulation**: Stagewise additive expansion of regression trees with shrinkage: $F_m(x) = F_{m-1}(x) + \gamma_m h_m(x)$.
- **Properties**: Captures complex non-linear interactions between calendar variables (month, day of year) and recent consumption.

### 4. XGBoost Regressor (`xgb-v1`)
- **Formulation**: Second-order Taylor approximation of loss with L1/L2 tree regularization (`reg_alpha`, `reg_lambda`).
- **Properties**: High execution speed, handles missing data naturally, and controls leaf complexity to prevent overfitting.

### 5. Hybrid Weighted Stacking Ensemble (`ensemble-v1`)
- **Formulation**: Convex combination of linear extrapolation and non-linear tree models:
  $$\hat{Y}_{\text{ens}} = \frac{1}{3} \hat{Y}_{\text{Ridge}} + \frac{1}{3} \hat{Y}_{\text{XGBoost}} + \frac{1}{3} \hat{Y}_{\text{RF}}$$
- **Properties**: Stabilizes variance across shifting seasonal regimes.

### 6. Ridge Regularized Linear Regression
- **Formulation**: Minimizes $\|y - Xw\|_2^2 + \alpha \|w\|_2^2$
- **Properties**: Standard L2 penalty preventing parameter divergence on correlated rolling statistics.

### 7. Random Forest Regressor
- **Formulation**: Bagging ensemble of 100 decorrelated decision trees with feature subsampling.
- **Properties**: Completely non-parametric, robust to extreme outliers, but cannot extrapolate trends beyond the historical training range.

---

## 4. Benchmark Metrics & Comparison Table

Evaluated using **chronological 5-fold expanding-window `TimeSeriesSplit`** and an unseen **30-day holdout test set**:

| Rank | Model Name | Test MAE (L) | Test RMSE (L) | Test MAPE (%) | CV MAE (L) | CV RMSE (L) | Selection Status |
|---|---|---|---|---|---|---|---|
| 🥇 | **Baseline (Past Week Persistence)** | **70.29** | **114.98** | **6.62%** | **71.39** | **92.18** | **Selected Winner** |
| 🥈 | **ElasticNet Regularized Linear** | 87.00 | 128.50 | 8.19% | 80.77 | 103.31 | Strongest Parametric |
| 🥉 | **Gradient Boosting Regressor** | 89.94 | 120.50 | 8.52% | 100.38 | 127.79 | Strong Non-Linear |
| 4 | **XGBoost Regressor (`xgb-v1`)** | 92.50 | 124.11 | 8.75% | 119.54 | 160.51 | Competitive Boosting |
| 5 | **Hybrid Weighted Ensemble (`ensemble-v1`)** | 93.49 | 131.07 | 8.82% | 89.71 | 116.64 | Balanced Blend |
| 6 | **Ridge Regularized Linear** | 98.44 | 143.98 | 9.29% | 92.53 | 121.99 | Linear Benchmark |
| 7 | **Random Forest Regressor** | 108.40 | 145.66 | 10.27% | 122.22 | 147.36 | High Tree Variance |

> **Key Machine Learning Insight**: In household water consumption, the **Past Week Persistence / ElasticNet** combination achieves a remarkably low Test MAPE of **6.62% to 8.19%** (~10 to 12 Litres error per day on a ~150 L/day household). Non-linear tree regressors (XGBoost, Random Forest) perform well but suffer from step-function leaf bounds when seasonal trends shift upward. The Hybrid Ensemble and ElasticNet provide the best balance of trend extrapolation and non-linear stability.

---

## 5. Feature Engineering

18 features engineered per device group:
1. **Calendar Features**: `day_of_week`, `is_weekend`, `month`, `day_of_year`.
2. **Weekly Lags**: `past_7d_liters`, `past_7d_lag7`, `past_7d_lag14`.
3. **Consumption Momentum**: `diff_7_14` ($\mu_7 - \mu_{14}$), `diff_14_21` ($\mu_{14} - \mu_{21}$).
4. **Daily Lags**: `lag_1`, `lag_2`, `lag_3`, `lag_7`.
5. **Rolling Statistics**: `rolling_mean_7`, `rolling_std_7`, `rolling_mean_14`, `rolling_mean_30`.
6. **Momentum Ratio**: `trend_ratio_7_30` ($\mu_7 / \mu_{30}$).

---

## 6. Directory Structure

```
ml-forecasting/
├── .env                       # Environment credentials (ML_GATEWAY_URL, X_API_TOKEN, PORT)
├── requirements.txt           # Python dependencies (fastapi, xgboost, scikit-learn, etc.)
├── config.py                  # Pipeline constants, target definitions, features list
├── data_loader.py             # Gateway client fetching devices & daily usage
├── feature_pipeline.py        # Feature extractor & ground-truth 7-day target generator
├── model_registry.py          # Implementations of all 7 candidate ML models
├── evaluator.py               # TimeSeriesSplit CV evaluator & matplotlib plotter
├── weekly_forecaster.py       # Single-figure weekly prediction builder (conforms to DB schema)
├── db_publisher.py            # Posts forecast payloads to Supabase ml-gateway
├── main.py                    # Production FastAPI server (/predict, /benchmark, /health)
├── run_benchmark.py           # CLI benchmark runner & prediction sync script
└── model_comparison.png       # Comparative visualization plot
```

---

## 7. How to Run Locally & In Production

### Running the CLI Benchmark & Prediction Pipeline
```bash
# Navigate to the folder
cd ml-forecasting

# Execute the complete benchmark and Supabase sync
python run_benchmark.py
```

### Running the FastAPI Microservice
```bash
# Start the server on port 8000
python main.py
# or: uvicorn main:app --host 0.0.0.0 --port 8000
```

### Endpoints
* `GET /health` — Service health and cache status.
* `GET /benchmark` — Runs model benchmark cross-validation and returns comparison table.
* `GET /predict` — Evaluates candidate models, selects the best model, predicts the single 1-figure weekly forecast (xxxL) for all devices, and saves to `ml_predictions`.
