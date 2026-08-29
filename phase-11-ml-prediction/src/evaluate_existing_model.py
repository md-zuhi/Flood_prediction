# evaluate_existing_model.py
# Proper evaluation of the existing flash-flood ML model without modifying it

import os
import joblib
import pandas as pd
import numpy as np

from sklearn.model_selection import GroupShuffleSplit, GroupKFold
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    precision_recall_curve,
    auc,
    confusion_matrix
)

# --------------------------------------------------
# Paths
# --------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "final_training_dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "models", "flash_flood_model_v1.joblib")
METADATA_PATH = os.path.join(BASE_DIR, "models", "model_metadata_v1.json")

# Features & targets
FEATURES = [
    "rain_1h_mm",
    "rain_3h_mm",
    "rain_6h_mm",
    "rain_12h_mm",
    "rain_24h_mm",
    "temperature_c",
    "humidity_percent",
    "soil_moisture_m3m3",
    "elevation_m"
]
TARGET = "flood_occurred"
GROUP_COLUMN = "district"

def main():
    # Load dataset
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    
    # Load model
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found at {MODEL_PATH}")
    model = joblib.load(MODEL_PATH)
    
    X = df[FEATURES]
    y = df[TARGET]
    groups = df[GROUP_COLUMN].astype(str)
    
    # District-based GroupShuffleSplit matching train_model.py
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))
    
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    groups_train, groups_test = groups.iloc[train_idx], groups.iloc[test_idx]
    
    # Double check no data leakage
    overlap = set(groups_train).intersection(set(groups_test))
    if overlap:
        print(f"WARNING: Geographic leakage detected! Overlap: {overlap}")
    
    # Predict on test set
    y_pred_test = model.predict(X_test)
    y_prob_test = model.predict_proba(X_test)[:, 1]
    
    # Predict on train set (to identify overfitting)
    y_pred_train = model.predict(X_train)
    y_prob_train = model.predict_proba(X_train)[:, 1]
    
    # Calculate test metrics
    acc_test = accuracy_score(y_test, y_pred_test)
    prec_test = precision_score(y_test, y_pred_test, zero_division=0)
    rec_test = recall_score(y_test, y_pred_test, zero_division=0)
    f1_test = f1_score(y_test, y_pred_test, zero_division=0)
    roc_auc_test = roc_auc_score(y_test, y_prob_test)
    
    # PR-AUC calculation
    p_prec, p_rec, _ = precision_recall_curve(y_test, y_prob_test)
    pr_auc_test = auc(p_rec, p_prec)
    
    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred_test)
    tn, fp, fn, tp = cm.ravel()
    
    # Flood / non-flood distribution in test set
    test_distribution = y_test.value_counts(normalize=True).to_dict()
    test_counts = y_test.value_counts().to_dict()
    
    # Train metrics for overfitting analysis
    acc_train = accuracy_score(y_train, y_pred_train)
    prec_train = precision_score(y_train, y_pred_train, zero_division=0)
    rec_train = recall_score(y_train, y_pred_train, zero_division=0)
    f1_train = f1_score(y_train, y_pred_train, zero_division=0)
    roc_auc_train = roc_auc_score(y_train, y_prob_train)
    p_prec_tr, p_rec_tr, _ = precision_recall_curve(y_train, y_prob_train)
    pr_auc_train = auc(p_rec_tr, p_prec_tr)
    
    # Identify Overfitting
    # Overfitting is typically indicated by significantly higher performance on training than testing
    overfitting_threshold = 0.10 # 10% difference
    diff_acc = acc_train - acc_test
    diff_roc = roc_auc_train - roc_auc_test
    overfitting_detected = "YES" if (diff_acc > overfitting_threshold or diff_roc > overfitting_threshold) else "NO"
    
    # GroupKFold Cross Validationgrouped by district
    n_splits_gkf = min(5, len(groups.unique()))
    gkf = GroupKFold(n_splits=n_splits_gkf)
    
    cv_accs, cv_precs, cv_recs, cv_f1s, cv_roc_aucs = [], [], [], [], []
    
    # To perform proper GKF cross-validation on this pipeline, we will fit copies of the same model pipeline type.
    # Note: LogisticRegression in V1 uses Pipeline with StandardScaler. Let's rebuild the pipeline structure.
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression
    
    for train_cv_idx, test_cv_idx in gkf.split(X, y, groups=groups):
        X_tr_cv, X_te_cv = X.iloc[train_cv_idx], X.iloc[test_cv_idx]
        y_tr_cv, y_te_cv = y.iloc[train_cv_idx], y.iloc[test_cv_idx]
        
        cv_pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=2000, random_state=42))
        ])
        
        cv_pipe.fit(X_tr_cv, y_tr_cv)
        cv_pred = cv_pipe.predict(X_te_cv)
        cv_prob = cv_pipe.predict_proba(X_te_cv)[:, 1]
        
        cv_accs.append(accuracy_score(y_te_cv, cv_pred))
        cv_precs.append(precision_score(y_te_cv, cv_pred, zero_division=0))
        cv_recs.append(recall_score(y_te_cv, cv_pred, zero_division=0))
        cv_f1s.append(f1_score(y_te_cv, cv_pred, zero_division=0))
        cv_roc_aucs.append(roc_auc_score(y_te_cv, cv_prob))
        
    cv_results = (
        f"Accuracy: {np.mean(cv_accs):.4f} ± {np.std(cv_accs):.4f} | "
        f"Precision: {np.mean(cv_precs):.4f} ± {np.std(cv_precs):.4f} | "
        f"Recall: {np.mean(cv_recs):.4f} ± {np.std(cv_recs):.4f} | "
        f"F1: {np.mean(cv_f1s):.4f} ± {np.std(cv_f1s):.4f} | "
        f"ROC-AUC: {np.mean(cv_roc_aucs):.4f} ± {np.std(cv_roc_aucs):.4f}"
    )
    
    print("\n" + "="*50)
    print("EVALUATION RESULTS")
    print("="*50)
    print(f"Training samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")
    print(f"Test Set Class Distribution:")
    for cls, cnt in test_counts.items():
        label = "Flood" if cls == 1 else "No Flood"
        print(f"  {label}: {cnt} ({test_distribution[cls]*100:.2f}%)")
        
    print("\nModel Performance on Test Set:")
    print(f"  Accuracy: {acc_test:.4f}")
    print(f"  Precision: {prec_test:.4f}")
    print(f"  Recall (Sensitivity): {rec_test:.4f}")
    print(f"  F1-Score: {f1_test:.4f}")
    print(f"  ROC-AUC: {roc_auc_test:.4f}")
    print(f"  PR-AUC: {pr_auc_test:.4f}")
    
    print("\nConfusion Matrix:")
    print(f"                        Predicted No Flood    Predicted Flood")
    print(f"Actual No Flood (0)     TN: {tn:<18}    FP: {fp}")
    print(f"Actual Flood (1)        FN: {fn:<18}    TP: {tp}")
    
    print("\nKey Metrics Summary:")
    print(f"  True Positives (TP): {tp}")
    print(f"  True Negatives (TN): {tn}")
    print(f"  False Positives (FP): {fp}")
    print(f"  False Negatives (FN): {fn}")
    print(f"  Flood Detection Rate (Recall): {tp / (tp + fn):.4f}")
    print(f"  Floods Missed (FN): {fn}")
    
    print("\nOverfitting Comparison (Train vs Test):")
    print(f"  Accuracy: Train {acc_train:.4f} vs Test {acc_test:.4f} (diff: {diff_acc:.4f})")
    print(f"  ROC-AUC:  Train {roc_auc_train:.4f} vs Test {roc_auc_test:.4f} (diff: {diff_roc:.4f})")
    print(f"  F1-Score: Train {f1_train:.4f} vs Test {f1_test:.4f}")
    print(f"  PR-AUC:   Train {pr_auc_train:.4f} vs Test {pr_auc_test:.4f}")
    print(f"  Overfitting detected: {overfitting_detected}")
    
    print("\nGroupKFold Cross-Validation Result:")
    print(f"  {cv_results}")
    
    print("\n" + "="*50)
    print("CONCISE REPORT FORMAT")
    print("="*50)
    print(f"MODEL: Logistic Regression")
    print(f"DATASET SIZE: {len(df)}")
    print(f"TEST SIZE: {len(X_test)}")
    print(f"ACCURACY: {acc_test:.4f}")
    print(f"PRECISION: {prec_test:.4f}")
    print(f"RECALL: {rec_test:.4f}")
    print(f"F1: {f1_test:.4f}")
    print(f"ROC-AUC: {roc_auc_test:.4f}")
    print(f"PR-AUC: {pr_auc_test:.4f}")
    print(f"TP: {tp}")
    print(f"TN: {tn}")
    print(f"FP: {fp}")
    print(f"FN: {fn}")
    print(f"FLOODS MISSED: {fn}")
    print(f"CROSS-VALIDATION RESULT: {cv_results}")
    print(f"OVERFITTING DETECTED: {overfitting_detected}")
    print("="*50)

if __name__ == "__main__":
    main()
