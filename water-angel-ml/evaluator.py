import os
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from model_registry import get_candidate_models
from config import BENCHMARK_TEST_DAYS

def evaluate_models(
    X: pd.DataFrame, 
    y: pd.Series, 
    test_days: int = BENCHMARK_TEST_DAYS,
    plot_path: str = "model_comparison.png"
) -> Tuple[pd.DataFrame, str, Any]:
    """
    Evaluates candidate models using chronological expanding-window TimeSeriesSplit 
    and holds out the final test_days as an unseen benchmark.
    
    Returns:
        results_df: DataFrame with comparative metrics (MAE, RMSE, MAPE, R2)
        best_model_name: Name of the winning algorithm
        best_model_instance: Trained model instance fitted on the full dataset
    """
    if len(X) < (test_days + 20):
        test_days = int(len(X) * 0.2)

    X_train, X_test = X.iloc[:-test_days], X.iloc[-test_days:]
    y_train, y_test = y.iloc[:-test_days], y.iloc[-test_days:]

    models = get_candidate_models()
    tscv = TimeSeriesSplit(n_splits=5)

    evaluation_records = []
    trained_models = {}

    for name, model in models.items():
        cv_maes = []
        cv_rmses = []
        cv_r2s = []

        # 1. Time-Series Cross Validation on Training Split
        for tr_idx, val_idx in tscv.split(X_train):
            X_tr, X_val = X_train.iloc[tr_idx], X_train.iloc[val_idx]
            y_tr, y_val = y_train.iloc[tr_idx], y_train.iloc[val_idx]

            try:
                model.fit(X_tr, y_tr)
                preds_val = model.predict(X_val)

                cv_maes.append(mean_absolute_error(y_val, preds_val))
                cv_rmses.append(np.sqrt(mean_squared_error(y_val, preds_val)))
                cv_r2s.append(r2_score(y_val, preds_val))
            except Exception as e:
                print(f"[EVALUATOR] Fold error for {name}: {e}")

        # 2. Fit on full training set and evaluate on unseen holdout test set
        model.fit(X_train, y_train)
        test_preds = model.predict(X_test)

        test_mae = mean_absolute_error(y_test, test_preds)
        test_rmse = np.sqrt(mean_squared_error(y_test, test_preds))
        test_r2 = r2_score(y_test, test_preds)
        test_mape = np.mean(np.abs((y_test - test_preds) / y_test)) * 100

        # Also fit final model instance on ALL data (ready for inference)
        final_instance = get_candidate_models()[name]
        final_instance.fit(X, y)
        trained_models[name] = final_instance

        evaluation_records.append({
            "Model Name": name,
            "Test MAE (L)": round(test_mae, 2),
            "Test RMSE (L)": round(test_rmse, 2),
            "Test MAPE (%)": round(test_mape, 2),
            "Test R²": round(test_r2, 4),
            "CV MAE (L)": round(np.mean(cv_maes) if cv_maes else 0, 2),
            "CV RMSE (L)": round(np.mean(cv_rmses) if cv_rmses else 0, 2),
            "CV R²": round(np.mean(cv_r2s) if cv_r2s else 0, 4)
        })

    results_df = pd.DataFrame(evaluation_records).sort_values("Test MAE (L)", ascending=True).reset_index(drop=True)

    # Best model is the top performer with lowest Test MAE / MAPE
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
        ax=axes[0],
        palette=palette
    )
    axes[0].set_title("Test Mean Absolute Error (Lower = Better)", fontsize=13, fontweight="bold")
    axes[0].set_xlabel("MAE (Litres / Week)", fontsize=11)
    axes[0].set_ylabel("")

    for i, v in enumerate(results_df["Test MAE (L)"]):
        axes[0].text(v + 1, i, f"{v:.1f} L", va="center", fontsize=10, fontweight="semibold")

    # Panel 2: Test MAPE Percentage (Lower is better)
    sns.barplot(
        data=results_df,
        y="Model Name",
        x="Test MAPE (%)",
        ax=axes[1],
        palette=palette
    )
    axes[1].set_title("Test Mean Absolute Percentage Error (MAPE)", fontsize=13, fontweight="bold")
    axes[1].set_xlabel("MAPE (%)", fontsize=11)
    axes[1].set_ylabel("")

    for i, v in enumerate(results_df["Test MAPE (%)"]):
        axes[1].text(v + 0.2, i, f"{v:.1f}%", va="center", fontsize=10, fontweight="semibold")

    plt.suptitle("Water Angel: Weekly Consumption ML Model Benchmark", fontsize=15, fontweight="bold", y=1.02)
    plt.tight_layout()
    plt.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close()
    print(f"[EVALUATOR] Comparison plot saved to {output_path}")
