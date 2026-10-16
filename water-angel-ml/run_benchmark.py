import os
import sys

# Configure UTF-8 stdout on Windows to prevent charmap encoding errors
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from data_loader import fetch_devices, fetch_daily_usage, fetch_all_historical_data
from feature_pipeline import prepare_training_data
from evaluator import evaluate_models
from weekly_forecaster import generate_weekly_forecast
from db_publisher import publish_weekly_predictions

def main():
    print("\n" + "="*80)
    print(" [WATER ANGEL] - ML CANDIDATE ALGORITHMS BENCHMARK & WEEKLY FORECAST")
    print("="*80)

    # 1. Ingestion
    print("\n[STEP 1] Fetching historical consumption records from Supabase ml-gateway...")
    df = fetch_all_historical_data(days=365)
    if df.empty:
        print("[ERROR] No historical daily usage data retrieved.")
        sys.exit(1)

    print(f"[OK] Retrieved {len(df)} total daily records across registered devices.")

    # 2. Feature Engineering
    print("\n[STEP 2] Running weekly feature pipeline (Lags, Rolling stats, Weekly ground truth)...")
    X, y = prepare_training_data(df)
    print(f"[OK] Formed {len(X)} training samples with {X.shape[1]} features.")

    # 3. Model Benchmark & Evaluation
    print("\n[STEP 3] Benchmarking candidate ML algorithms using TimeSeriesSplit (5 folds)...")
    results_df, best_name, best_model = evaluate_models(X, y, test_days=30, plot_path="model_comparison.png")

    print("\n" + "="*95)
    print(" [BENCHMARK] CANDIDATE ALGORITHMS BENCHMARK COMPARISON TABLE")
    print("="*95)
    print(results_df.to_string(index=False))
    print("="*95)
    print(f"\n[SELECTED] Winning Algorithm: {best_name}")

    # 4. Generate Weekly Single-Figure Forecasts
    print("\n[STEP 4] Generating single-figure weekly forecasts (xxxL) for upcoming 7 days...")
    devices = fetch_devices()
    predictions = []

    for dev_id in devices:
        dev_df = fetch_daily_usage(dev_id, days=90)
        pred = generate_weekly_forecast(
            device_id=dev_id,
            device_df=dev_df,
            model=best_model,
            model_name=best_name,
            confidence_score=0.92
        )
        if pred:
            predictions.append(pred)
            print(f"  * Device {dev_id}:")
            print(f"    - Coming Week Total: {pred['predicted_value']} Litres")
            print(f"    - Daily Average:    {pred['metadata']['daily_average_liters']} L/day")
            print(f"    - Forecast Horizon:  {pred['metadata']['week_start']} to {pred['metadata']['week_end']}")
            print(f"    - Algorithm Used:    {best_name} ({pred['model_version']})")

    # 5. Persist to Supabase ml_predictions Table
    if predictions:
        print("\n[STEP 5] Publishing predictions to Supabase ml_predictions table...")
        res = publish_weekly_predictions(predictions)
        print(f"[OK] Database response: {res}")

    print("\n[SUCCESS] Benchmark and weekly forecasting pipeline completed successfully!\n")

if __name__ == "__main__":
    main()
