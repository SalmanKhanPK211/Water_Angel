import os
import sys

# Configure UTF-8 stdout on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import numpy as np
import pandas as pd
import shap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw, ImageFont
import xgboost as xgb

from data_loader import fetch_all_historical_data
from feature_pipeline import split_train_test_chronological
from config import FEATURES

def run_shap_analysis(output_dir: str = "."):
    """
    Dedicated standalone SHAP analysis module for Water Angel weekly forecasting.
    Renders clean, spacious, high-resolution individual and combined plots 
    with zero text congestion, fitted on leak-free chronologically partitioned data.
    """
    print("="*80)
    print(" [WATER ANGEL] - LEAK-FREE SHAP FEATURE INTERPRETABILITY ANALYSIS")
    print("="*80)

    # 1. Fetch data & prepare features with zero leakage
    print("\n[STEP 1] Fetching historical consumption dataset from Supabase...")
    df = fetch_all_historical_data(days=365)
    if df.empty:
        raise ValueError("No historical daily data available.")

    print(f"[OK] Retrieved {len(df)} records. Applying leak-free chronological partitioning...")
    train_df, test_df, clipping_bounds = split_train_test_chronological(df, test_days=30)

    X_train = train_df[FEATURES]
    y_train = train_df["target_weekly_liters"]
    X_test  = test_df[FEATURES]
    print(f"[OK] Leak-free training samples: {len(X_train)} rows across {len(FEATURES)} features.")
    print(f"[OK] Out-of-sample test samples: {len(X_test)} rows.")

    # 2. Train XGBoost Model on Training Partition Only
    print("\n[STEP 2] Fitting XGBoost model on leak-free training partition...")
    model = xgb.XGBRegressor(
        n_estimators=80,
        max_depth=3,
        learning_rate=0.05,
        reg_alpha=1.0,
        reg_lambda=1.0,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42
    )
    model.fit(X_train, y_train)

    # 3. Compute Out-of-Sample SHAP Values
    print("[STEP 3] Computing out-of-sample SHAP values using TreeExplainer...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X_test)

    # Feature Importance Table
    mean_abs_shap = np.abs(shap_values.values).mean(axis=0)
    importance_df = pd.DataFrame({
        "Rank": range(1, len(FEATURES) + 1),
        "Feature": [f for _, f in sorted(zip(mean_abs_shap, FEATURES), reverse=True)],
        "Mean_Abs_SHAP_Litres": sorted(mean_abs_shap, reverse=True)
    })
    importance_df["Mean_Abs_SHAP_Litres"] = importance_df["Mean_Abs_SHAP_Litres"].round(2)

    csv_path = os.path.join(output_dir, "shap_feature_importance.csv")
    importance_df.to_csv(csv_path, index=False)
    print(f"[OK] Feature importance table saved to: {csv_path}")

    # -------------------------------------------------------------
    # 4. PLOT 1: STANDALONE BAR IMPORTANCE PLOT (Crisp & Spacious)
    # -------------------------------------------------------------
    print("\n[STEP 4] Generating clean Bar Importance plot...")
    plt.figure(figsize=(11, 8.5), dpi=250)
    shap.plots.bar(shap_values, max_display=14, show=False)
    plt.title("(A) Global Feature Importance (|Mean SHAP Value|)", fontsize=13, fontweight="bold", pad=16)
    plt.xlabel("Mean |SHAP Value| (Volumetric Impact in Litres / Week)", fontsize=11, labelpad=10)
    plt.tight_layout()
    bar_path = os.path.join(output_dir, "shap_bar_importance.png")
    plt.savefig(bar_path, dpi=250, bbox_inches="tight")
    plt.close()
    print(f"[OK] Clean Bar plot saved to: {bar_path}")

    # -------------------------------------------------------------
    # 5. PLOT 2: STANDALONE BEESWARM PLOT (Crisp & Spacious)
    # -------------------------------------------------------------
    print("[STEP 5] Generating clean Beeswarm Directionality plot...")
    plt.figure(figsize=(11.5, 8.5), dpi=250)
    shap.plots.beeswarm(shap_values, max_display=14, show=False)
    plt.title("(B) Feature Value Impact & Directionality (Beeswarm)", fontsize=13, fontweight="bold", pad=16)
    plt.xlabel("SHAP Value (Positive = Higher Weekly Litres, Negative = Lower)", fontsize=11, labelpad=10)
    plt.tight_layout()
    bee_path = os.path.join(output_dir, "shap_beeswarm_distribution.png")
    plt.savefig(bee_path, dpi=250, bbox_inches="tight")
    plt.close()
    print(f"[OK] Clean Beeswarm plot saved to: {bee_path}")

    # -------------------------------------------------------------
    # 6. PLOT 3: COMPOSITE NON-CONGESTED COMBINED IMAGE VIA PIL
    # -------------------------------------------------------------
    print("[STEP 6] Compositing side-by-side plot with generous whitespace...")
    img_bar = Image.open(bar_path)
    img_bee = Image.open(bee_path)

    # Harmonize heights
    target_height = max(img_bar.height, img_bee.height)
    w_bar = int(img_bar.width * (target_height / img_bar.height))
    w_bee = int(img_bee.width * (target_height / img_bee.height))

    img_bar_resized = img_bar.resize((w_bar, target_height), Image.Resampling.LANCZOS)
    img_bee_resized = img_bee.resize((w_bee, target_height), Image.Resampling.LANCZOS)

    gap = 120  # generous 120px whitespace to completely eliminate congestion
    banner_height = 140

    total_width = w_bar + w_bee + gap + 100
    total_height = target_height + banner_height + 60

    composite = Image.new("RGB", (total_width, total_height), color="white")
    draw = ImageDraw.Draw(composite)

    # Draw Title Header
    header_text = "Water Angel: Weekly Water Consumption SHAP Feature Interpretability"
    try:
        font_title = ImageFont.truetype("arial.ttf", 46)
        font_sub = ImageFont.truetype("arial.ttf", 26)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    draw.text((60, 35), header_text, fill="#0f172a", font=font_title)
    draw.text((60, 95), "Global Impact Magnitude (|Mean SHAP|) vs. Directional Feature Value Attribution (Out-of-Sample)", fill="#475569", font=font_sub)

    # Paste subplots
    composite.paste(img_bar_resized, (50, banner_height))
    composite.paste(img_bee_resized, (50 + w_bar + gap, banner_height))

    combined_path = os.path.join(output_dir, "shap_feature_importance.png")
    composite.save(combined_path, quality=95)
    print(f"[OK] Flawless composite image saved to: {combined_path}")

    print("\n" + "="*80)
    print(" TOP 10 SHAP PREDICTIVE FEATURES (WATER ANGEL - LEAK-FREE)")
    print("="*80)
    print(importance_df.head(10).to_string(index=False))
    print("="*80)
    print("\n[SUCCESS] Leak-free SHAP analysis script finished cleanly!\n")

if __name__ == "__main__":
    run_shap_analysis()
