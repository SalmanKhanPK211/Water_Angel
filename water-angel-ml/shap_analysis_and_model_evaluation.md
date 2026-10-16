# 🔍 Water Angel: SHAP Feature Importance Analysis & Model Performance Breakdown

---

## 📌 1. Overview & Artifacts Generated

To provide full transparency and interpretability for the Water Angel predictive intelligence system, this report details:
1. **The Comprehensive Multi-Tab Excel Workbook**: [`Water_Angel_ML_Features_and_Predictions.xlsx`](file:///c:/Users/salma/Desktop/WaterAngel%20-%20Copy/ml-forecasting/Water_Angel_ML_Features_and_Predictions.xlsx) containing feature definitions, real engineered dataset samples, candidate model metrics, and live Supabase prediction records.
2. **SHAP (SHapley Additive exPlanations) Analysis**: Quantifying each feature's marginal contribution to weekly volumetric forecasts via cooperative game theory.
3. **In-Depth Architectural & Mathematical Evaluation**: Explaining why empirical baseline persistence and regularized linear models (ElasticNet) outperformed non-linear tree ensembles on this time-series dataset.

---

## 📊 2. SHAP Feature Interpretability Analysis

Using `shap.TreeExplainer` on the gradient-boosted forecasting engine across all 378 time-series observations, we measured the global feature impact and individual directional effects:

![Water Angel SHAP Feature Analysis](file:///C:/Users/salma/.gemini/antigravity/brain/239db332-19b3-4e70-ab5d-90fdac5204c0/shap_feature_importance.png)

### Key Insights from SHAP Attribution:
* **Panel A (Global Importance - Mean |SHAP|)**: Ranks features by their overall magnitude of influence on the predicted weekly litres.
* **Panel B (Beeswarm Directionality)**: Depicts whether high values (red) or low values (blue) increase or decrease the forecast:
  - **`past_7d_liters` (Rank 1)**: Dominates the model with a **Mean |SHAP| of 73.89 Litres**. High past 7-day usage (red dots) shifts the forecast heavily to the right (+150L to +250L), while low past usage pulls it down.
  - **`rolling_mean_7` (Rank 2)**: Contributes **45.73 Litres** of impact, acting as the primary velocity scaling factor.
  - **`day_of_year` (Rank 3)**: Contributes **38.32 Litres** of impact, capturing continuous annual seasonality (seasonal heating, summer washing frequency) without month-boundary jumps.
  - **`rolling_mean_30` (Rank 4)**: Contributes **11.32 Litres** of impact, establishing the household's long-term volumetric capacity anchor.

---

## 📑 3. Feature Inventory & SHAP Importance Table

The 18 features used by the forecasting engine, ranked by their empirical SHAP predictive power:

| Rank | Feature Name | Category | Mean \|SHAP\| (L) | Mathematical Formula | Physical Meaning & Domain Impact |
|:---:|---|---|:---:|---|---|
| **1** | `past_7d_liters` | Weekly Aggregated Lag | **73.89** | $\sum_{i=0}^6 y_{t-i}$ | Total litres consumed over the last 7 days; strongest habitual anchor. |
| **2** | `rolling_mean_7` | Rolling Statistics | **45.73** | $\frac{1}{7}\sum_{i=0}^6 y_{t-i}$ | 7-day daily run rate; scales per-day allocation. |
| **3** | `day_of_year` | Calendar & Cyclical | **38.32** | $t_{\text{day}} \in [1, 366]$ | Continuous annual progression; maps seasonal weather curves. |
| **4** | `rolling_mean_30` | Rolling Statistics | **11.32** | $\frac{1}{30}\sum_{i=0}^{29} y_{t-i}$ | Long-term monthly baseline consumption. |
| **5** | `rolling_mean_14` | Rolling Statistics | **8.73** | $\frac{1}{14}\sum_{i=0}^{13} y_{t-i}$ | Bi-weekly smoothed baseline filtering weekend noise. |
| **6** | `past_7d_lag14` | Weekly Aggregated Lag | **7.39** | $\sum_{i=14}^{20} y_{t-i}$ | Consumption 3 weeks ago; checks multi-week consistency. |
| **7** | `month` | Calendar & Cyclical | **5.60** | $t_{\text{month}} \in [1, 12]$ | Macro seasonal month indicator. |
| **8** | `trend_ratio_7_30` | Trend Indicators | **5.52** | $\mu_7 / \mu_{30}$ | Surge/conservation momentum indicator ($>1.0$ = accelerating). |
| **9** | `lag_1` | Daily Lag | **5.42** | $y_{t-1}$ | Yesterday's water consumption; short-term memory register. |
| **10** | `diff_14_21` | Consumption Momentum | **3.73** | $\text{past}_{14} - \text{past}_{21}$ | Historical weekly acceleration trajectory. |
| **11** | `rolling_std_7` | Rolling Statistics | **2.89** | $\sigma(y_{t-6:t})$ | 7-day volatility; distinguishes steady vs erratic usage. |
| **12** | `lag_2` | Daily Lag | **2.59** | $y_{t-2}$ | Consumption 2 days ago; short-term smoothing. |
| **13** | `past_7d_lag7` | Weekly Aggregated Lag | **2.10** | $\sum_{i=7}^{13} y_{t-i}$ | Total litres consumed during the week before last. |
| **14** | `lag_3` | Daily Lag | **0.87** | $y_{t-3}$ | Consumption 3 days ago. |
| **15** | `diff_7_14` | Consumption Momentum | **0.66** | $\text{past}_{7} - \text{past}_{14}$ | Net change in weekly consumption rate. |
| **16** | `lag_7` | Daily Lag | **0.39** | $y_{t-7}$ | Exact same day of the week last week. |
| **17** | `day_of_week` | Calendar & Cyclical | **0.09** | $t_{\text{dow}} \in [0, 6]$ | Day of week index (Monday=0 to Sunday=6). |
| **18** | `is_weekend` | Calendar & Cyclical | **0.00** | $1 \text{ if dow} \ge 5 \text{ else } 0$ | Weekend indicator; absorbed by rolling aggregates in weekly totals. |

---

## 📁 4. The Multi-Tab Excel Workbook Structure

The generated Excel file [`Water_Angel_ML_Features_and_Predictions.xlsx`](file:///c:/Users/salma/Desktop/WaterAngel%20-%20Copy/ml-forecasting/Water_Angel_ML_Features_and_Predictions.xlsx) is organized into four formatted worksheets:

1. **`Feature_Dictionary_SHAP`**:
   - Contains all 18 features with technical categories, data types, exact mathematical formulas, physical domain relevance, expected directional impacts, and empirical SHAP importance values.
2. **`Model_Benchmark_Metrics`**:
   - Stores the complete comparative benchmark results across all 7 candidate algorithms (Test MAE, Test RMSE, Test MAPE, Test $R^2$, CV MAE, CV RMSE, CV $R^2$, and Model Selection Status).
3. **`Engineered_Features_Dataset`**:
   - The actual feature dataset ($X$) with `device_id`, `usage_date`, all 18 feature values, and the ground-truth target `target_weekly_liters` ($y$).
4. **`Live_ml_predictions_Table`**:
   - Exact mirror of the Supabase `ml_predictions` table showing the latest live weekly forecast rows populated by the pipeline.

---

## 🧠 5. Deep Analysis: Why Certain ML Models Outperformed in this Data

A central question in time-series machine learning is why simpler or regularized models often outperform complex non-linear models. Here is the mathematical and domain breakdown:

### 5.1 The Strong Empirical Autocorrelation of Domestic Water Usage
In residential households, water consumption is governed by human routines:
$$\text{Autocorrelation } \rho(Y_t, Y_{t-7}) \approx 0.93$$
Family members maintain consistent habits (morning showers, dishwashing, laundry frequency). Unless a major disruption occurs (vacations, guests), water used during days $[t-6 \dots t]$ is a near-sufficient statistic for days $[t+1 \dots t+7]$. 

The **Past Week Persistence** model achieved a Test MAPE of **6.62%** and Test MAE of **70.29 Litres** because it exploits this physical inertia directly with zero variance:
$$\text{Var}(\hat{Y}_{\text{persist}}) = 0$$

### 5.2 The "Extrapolation Barrier" of Decision Tree Ensembles (XGBoost & Random Forest)
Why did **Random Forest** (10.27% MAPE) and **XGBoost** (8.75% MAPE) trail behind Persistence (6.62%) and ElasticNet (8.19%) on the holdout test set?

```
      Continuous True Trend (Summer/Seasonal Surge)
      /
     /
    /       <--- Linear Models (ElasticNet/Ridge) Extrapolate Outward
   /
  ┌──────┐  <--- Tree-Based Models (XGBoost/RF) Flatten at Max Leaf Value
  │ Leaf │
──┴──────┴───────────────────────────
   Historical Training Domain | Unseen Holdout Horizon
```

* **Step-Function Partitions**: Decision trees divide feature space into orthogonal hypercubes ($X_j \le \theta$). Every leaf node outputs the sample mean of the training data in that leaf:
  $$\hat{y}(x) = \sum_{m=1}^M c_m I(x \in R_m)$$
* **Bounded Output Range**: A regression tree **can never predict a value outside the bounds of its historical training targets**:
  $$\hat{y}(x) \in [\min(y_{\text{train}}), \max(y_{\text{train}})]$$
* **Seasonal Shift Impact**: The holdout test set (the final 30 days of the year) exhibited an upward seasonal consumption surge (from ~100 L/day to ~150 L/day). When presented with feature values higher than past observations, tree models clipped predictions at their highest historical split, causing systematic under-prediction.

### 5.3 The Regularization Superiority of ElasticNet
Why did **ElasticNet** emerge as the top parametric model (8.19% MAPE)?
* **Multicollinearity in Time-Series Features**: Many of our features (`past_7d_liters`, `rolling_mean_7`, `rolling_mean_14`, `rolling_mean_30`) are naturally correlated ($r > 0.85$). Standard Ordinary Least Squares (OLS) or unregularized models suffer from erratic, diverging weights:
  $$\text{Var}(\hat{\beta}_{\text{OLS}}) = \sigma^2 (X^T X)^{-1}$$
* **The ElasticNet Compromise**:
  - The $L_2$ penalty (Ridge component) shrinks correlated coefficients toward each other, preventing parameter explosion.
  - The $L_1$ penalty (Lasso component) zeros out redundant daily noise variables (`lag_3`, `lag_7`, `is_weekend`).
  - ElasticNet effectively assigned heavy weight to `past_7d_liters` and `day_of_year`, while allowing smooth linear extrapolation into the higher consumption regime.

### 5.4 When Do XGBoost and Random Forest Win?
Tree-based models become vastly superior in environments where:
1. **Exogenous Sensor Telemetry is Injected**: When environmental sensors (ambient temperature, rainfall, humidity) or tank flow rates are available, tree ensembles excel at learning non-linear threshold rules (e.g., `IF temp > 35°C AND humidity < 25% THEN surge +45%`).
2. **Multi-Tenant / Commercial Buildings**: Where occupancy fluctuates unpredictably (hotels, universities, commercial kitchens) and linear persistence breaks down.
3. **Anomaly & Leak Regimes**: Detecting rapid deviations that violate linear relationships.

---

## 🏆 6. Summary Comparison Table

| Model Name | Test MAE (L) | Test MAPE (%) | Extrapolation Ability | Resistance to Overfitting | Best Fit Domain |
|---|:---:|:---:|:---:|:---:|---|
| **Baseline (Past Week Persistence)** | **70.29** | **6.62%** | High (Tracks recent baseline) | Complete ($\text{Var}=0$) | Stable domestic households |
| **ElasticNet Regularized Linear** | **87.00** | **8.19%** | High (Linear slope) | High ($L_1 + L_2$ shrinkage) | Trending households with seasonal shifts |
| **Gradient Boosting (sklearn)** | **89.94** | **8.52%** | Moderate (Bounded leaves) | Moderate (Shrinkage $\eta=0.05$) | Non-linear calendar interactions |
| **XGBoost Regressor (`xgb-v1`)** | **92.50** | **8.75%** | Moderate (Bounded leaves) | High (Tree complexity regularization) | Fast inference & multi-sensor telemetry |
| **Hybrid Weighted Ensemble** | **93.49** | **8.82%** | High (Blends linear + trees) | High (Variance reduction via voting) | General-purpose production default |
| **Ridge Regularized Linear** | **98.44** | **9.29%** | High (Linear slope) | Moderate ($L_2$ only) | Baseline continuous scaling |
| **Random Forest Regressor** | **108.40** | **10.27%** | Low (Step-function leaves) | Moderate (Bagging helps, but sensitive to trends) | Outlier-heavy datasets |
