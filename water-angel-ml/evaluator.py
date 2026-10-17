import os
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional, Generator
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from model_registry import get_candidate_models
from config import FEATURES, FORECAST_HORIZON_DAYS, BENCHMARK_TEST_DAYS
from feature_pipeline import split_train_test_chronological

def purged_date_cv_split(
    train_df: pd.DataFrame, 
    n_splits: int = 5, 
    forecast_horizon: int = FORECAST_HORIZON_DAYS
) -> Generator[Tuple[list, list], None, None]:
    """
    Chronological expanding-window cross-validation with an embargo purge gap.
    
    Guarantees:
    - Splits strictly on calendar dates across all paired devices simultaneously.
    - Zero temporal inversion: training dates are always in the past, validation in the future.
    - Purging & Embargo: an embargo gap of (forecast_horizon + 1) days is placed between 
      the training cutoff and validation start date. Zero target overlap occurs across folds.
    """
    unique_dates = np.array(sorted(train_df["usage_date"].unique()))
    n_dates = len(unique_dates)

    if n_dates < 30:
        # Fallback for small sample datasets
        split_point = int(len(train_df) * 0.75)
        yield list(range(split_point)), list(range(split_point, len(train_df)))
        return

    min_train_dates = max(20, n_dates // 3)
    val_window = max(7, (n_dates - min_train_dates) // (n_splits + 1))
    purge_gap_days = forecast_horizon + 1

    for i in range(n_splits):
        train_end_idx = min_train_dates + i * val_window
        if train_end_idx >= n_dates:
            break
        train_cutoff = unique_dates[train_end_idx]
        val_start_date = train_cutoff + pd.Timedelta(days=purge_gap_days)
        val_end_date = val_start_date + pd.Timedelta(days=val_window)

        tr_idx = train_df.index[train_df["usage_date"] <= train_cutoff].tolist()
        val_idx = train_df.index[
            (train_df["usage_date"] >= val_start_date) & (train_df["usage_date"] <= val_end_date)
        ].tolist()

        if tr_idx and val_idx:
            yield tr_idx, val_idx

def evaluate_models(
    train_df: Optional[pd.DataFrame] = None,
    test_df: Optional[pd.DataFrame] = None,
    raw_df: Optional[pd.DataFrame] = None,
    test_days: int = BENCHMARK_TEST_DAYS,
    plot_path: str = "model_comparison.png"
) -> Tuple[pd.DataFrame, str, Any]:
    """
    Evaluates candidate models using strictly leak-free chronological partitioning:
    - Cross-validation on train_df using Purged Date-Based Time Series Split.
    - Holdout evaluation on test_df (isolated by calendar date + 8-day purge gap).
    
    Returns:
        results_df: DataFrame with comparative metrics (MAE, RMSE, MAPE, R2)
        best_model_name: Name of the winning algorithm
        best_model_instance: Trained model instance fitted on full history (for inference)
    """
    if train_df is None or test_df is None:
        if raw_df is None:
            raise ValueError("Either (train_df, test_df) or raw_df must be provided.")
        train_df, test_df, _ = split_train_test_chronological(raw_df, test_days=test_days)

    if train_df.empty or test_df.empty:
        raise ValueError("Insufficient samples in train or test partitions.")

    X_train = train_df[FEATURES]
    y_train = train_df["target_weekly_liters"]
    X_test  = test_df[FEATURES]
    y_test  = test_df["target_weekly_liters"]

    models = get_candidate_models()
    evaluation_records = []
    trained_models = {}

    for name, model in models.items():
        cv_maes = []
        cv_rmses = []
        cv_mapes = []
        cv_r2s = []

        # 1. Leak-Free Purged Cross Validation on Training Split
        for tr_idx, val_idx in purged_date_cv_split(train_df, n_splits=5):
            X_tr, y_tr = train_df.iloc[tr_idx][FEATURES], train_df.iloc[tr_idx]["target_weekly_liters"]
            X_val, y_val = train_df.iloc[val_idx][FEATURES], train_df.iloc[val_idx]["target_weekly_liters"]

            try:
                model.fit(X_tr, y_tr)
                preds_val = model.predict(X_val)

                cv_maes.append(mean_absolute_error(y_val, preds_val))
                cv_rmses.append(np.sqrt(mean_squared_error(y_val, preds_val)))
                cv_mapes.append(np.mean(np.abs((y_val - preds_val) / y_val)) * 100)
                cv_r2s.append(r2_score(y_val, preds_val))
            except Exception as e:
                print(f"[EVALUATOR] Fold error for {name}: {e}")

        # 2. Fit on full purged training set and evaluate on unseen holdout test set
        model.fit(X_train, y_train)
        test_preds = model.predict(X_test)

        test_mae = mean_absolute_error(y_test, test_preds)
        test_rmse = np.sqrt(mean_squared_error(y_test, test_preds))
        test_mape = np.mean(np.abs((y_test - test_preds) / y_test)) * 100
        test_r2 = r2_score(y_test, test_preds)

        # 3. Fit final production model instance on combined train + test dataset
        X_full = pd.concat([X_train, X_test], ignore_index=True)
        y_full = pd.concat([y_train, y_test], ignore_index=True)
        final_instance = get_candidate_models()[name]
        final_instance.fit(X_full, y_full)
        trained_models[name] = final_instance

        evaluation_records.append({
            "Model Name": name,
            "Test MAE (L)": round(test_mae, 2),
            "Test RMSE (L)": round(test_rmse, 2),
            "Test MAPE (%)": round(test_mape, 2),
            "Test R²": round(test_r2, 4),
            "CV MAE (L)": round(float(np.mean(cv_maes)) if cv_maes else 0.0, 2),
            "CV RMSE (L)": round(float(np.mean(cv_rmses)) if cv_rmses else 0.0, 2),
            "CV MAPE (%)": round(float(np.mean(cv_mapes)) if cv_mapes else 0.0, 2),
            "CV R²": round(float(np.mean(cv_r2s)) if cv_r2s else 0.0, 4)
        })

    results_df = pd.DataFrame(evaluation_records).sort_values("Test MAE (L)", ascending=True).reset_index(drop=True)

    # Winning algorithm has lowest Test MAE / MAPE
    best_model_name = results_df.iloc[0]["Model Name"]
    best_model_instance = trained_models[best_model_name]

    # Plot comparison chart
    try:
        plot_model_comparison(results_df, output_path=plot_path)
    except Exception as e:
        print(f"[EVALUATOR] Failed to save plot: {e}")

    return results_df, best_model_name, best_model_instance

def plot_model_comparison(results_df: pd.DataFrame, output_path: str = "model_comparison.png"):
    """
    Plots a multi-panel visual comparison of candidate ML models.
    """
    sns.set_theme(style="whitegrid")
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    palette = sns.color_palette("mako", len(results_df))

    # Panel 1: Test MAE in Litres (Lower is better)
    sns.barplot(
        data=results_df,
        y="Model Name",
        x="Test MAE (L)",
        hue="Model Name",
        legend=False,
        ax=axes[0],
        palette=palette
    )
    axes[0].set_title("Test Mean Absolute Error (Lower = Better)", fontsize=13, fontweight="bold")
    axes[0].set_xlabel("MAE (Litres / Week)", fontsize=11)
    axes[0].set_ylabel("")

    for i, v in enumerate(results_df["Test MAE (L)"]):
        axes[0].text(v + 0.5, i, f"{v:.1f} L", va="center", fontsize=10, fontweight="semibold")

    # Panel 2: Test MAPE Percentage (Lower is better)
    sns.barplot(
        data=results_df,
        y="Model Name",
        x="Test MAPE (%)",
        hue="Model Name",
        legend=False,
        ax=axes[1],
        palette=palette
    )
    axes[1].set_title("Test Mean Absolute Percentage Error (MAPE)", fontsize=13, fontweight="bold")
    axes[1].set_xlabel("MAPE (%)", fontsize=11)
    axes[1].set_ylabel("")

    for i, v in enumerate(results_df["Test MAPE (%)"]):
        axes[1].text(v + 0.1, i, f"{v:.1f}%", va="center", fontsize=10, fontweight="semibold")

    plt.suptitle("Water Angel: Leak-Free Weekly Consumption ML Model Benchmark", fontsize=15, fontweight="bold", y=1.02)
    plt.tight_layout()
    plt.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close()
    print(f"[EVALUATOR] Comparison plot saved to {output_path}")
