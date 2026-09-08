import xgboost as xgb
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from data_fetcher import fetch_all_historical_data
from feature_engineering import engineer_features, get_x_y

def train_global_model():
    print(" Fetching all historical data...")
    # 🔥 CHANGE 1: Fetch up to 1 YEAR of data (365 days)
    df = fetch_all_historical_data(days=365)
    if df.empty:
        raise ValueError("No historical data found for any device.")

    print(" Engineering features...")
    df_feat = engineer_features(df)
    if df_feat.empty:
        raise ValueError("Not enough data after feature engineering.")

    X, y = get_x_y(df_feat)
    
    # --- 🔥 CHANGE 2: Reserve the LAST 30 DAYS as the test set ---
    # If we have fewer than 50 rows, fallback to 20% test size.
    test_size = 30
    if len(X) < 50:
        test_size = int(len(X) * 0.2)
    
    split_idx = len(X) - test_size
    X_train_full, X_test = X[:split_idx], X[split_idx:]
    y_train_full, y_test = y[:split_idx], y[split_idx:]

    print(f" Total rows: {len(X)}")
    print(f" Training set: {len(X_train_full)} rows")
    print(f" Test set (holdout - last {test_size} days): {len(X_test)} rows")

    # --- Time-Series Cross-Validation ---
    print("\n Performing Time-Series Cross-Validation (Expanding Window)...")
    
    param_grid = [
        {'max_depth': 2, 'learning_rate': 0.05, 'n_estimators': 50, 'reg_alpha': 1.0, 'reg_lambda': 1.0},
        {'max_depth': 3, 'learning_rate': 0.05, 'n_estimators': 100, 'reg_alpha': 1.0, 'reg_lambda': 1.0},
        {'max_depth': 4, 'learning_rate': 0.1, 'n_estimators': 50, 'reg_alpha': 0.5, 'reg_lambda': 0.5},
        {'max_depth': 3, 'learning_rate': 0.1, 'n_estimators': 80, 'reg_alpha': 2.0, 'reg_lambda': 2.0},
    ]
    
    tscv = TimeSeriesSplit(n_splits=5)
    best_params = None
    best_avg_score = -np.inf

    for params in param_grid:
        fold_scores = []
        for train_idx, val_idx in tscv.split(X_train_full):
            X_train_cv, X_val = X_train_full.iloc[train_idx], X_train_full.iloc[val_idx]
            y_train_cv, y_val = y_train_full.iloc[train_idx], y_train_full.iloc[val_idx]
            
            model = xgb.XGBRegressor(
                n_estimators=params['n_estimators'],
                max_depth=params['max_depth'],
                learning_rate=params['learning_rate'],
                reg_alpha=params['reg_alpha'],
                reg_lambda=params['reg_lambda'],
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42
            )
            model.fit(X_train_cv, y_train_cv)
            y_pred = model.predict(X_val)
            r2 = r2_score(y_val, y_pred)
            fold_scores.append(r2)
        
        avg_r2 = np.mean(fold_scores)
        print(f"  Params {params} -> Avg R² (CV): {avg_r2:.4f}")
        
        if avg_r2 > best_avg_score:
            best_avg_score = avg_r2
            best_params = params

    print(f"\n Best CV Params: {best_params} (Avg R²: {best_avg_score:.4f})")

    # --- Train FINAL model on the FULL training set ---
    final_model = xgb.XGBRegressor(
        n_estimators=best_params['n_estimators'],
        max_depth=best_params['max_depth'],
        learning_rate=best_params['learning_rate'],
        reg_alpha=best_params['reg_alpha'],
        reg_lambda=best_params['reg_lambda'],
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42
    )
    final_model.fit(X_train_full, y_train_full)

    # --- Final Evaluation on the HIDDEN TEST SET (Last 30 days) ---
    y_test_pred = final_model.predict(X_test)
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
    test_r2 = r2_score(y_test, y_test_pred)

    print("\n" + "="*50)
    print(" FINAL MODEL PERFORMANCE (ON UNSEEN 30-DAY HOLDOUT)")
    print("="*50)
    print(f"  MAE:  {test_mae:.2f} L/day")
    print(f"  RMSE: {test_rmse:.2f} L/day")
    print(f"  R²:   {test_r2:.4f}")
    print("="*50 + "\n")

    return final_model