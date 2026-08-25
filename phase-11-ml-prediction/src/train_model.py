import os
import json
import joblib
import pandas as pd
import numpy as np

from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix
)


# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_PATH = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "final_training_dataset.csv"
)

MODELS_DIR = os.path.join(BASE_DIR, "models")

REPORT_PATH = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "model_evaluation_v1.txt"
)

MODEL_PATH = os.path.join(
    MODELS_DIR,
    "flash_flood_model_v1.joblib"
)

METADATA_PATH = os.path.join(
    MODELS_DIR,
    "model_metadata_v1.json"
)

os.makedirs(MODELS_DIR, exist_ok=True)


# --------------------------------------------------
# ML Features
# --------------------------------------------------

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


# --------------------------------------------------
# Load Dataset
# --------------------------------------------------

df = pd.read_csv(DATA_PATH)

print("Dataset loaded:", len(df), "rows")


# --------------------------------------------------
# Validate Required Columns
# --------------------------------------------------

required_columns = FEATURES + [TARGET, GROUP_COLUMN]

missing_columns = [
    col for col in required_columns
    if col not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing required columns: {missing_columns}"
    )


# --------------------------------------------------
# Check Missing Values
# --------------------------------------------------

feature_missing = df[FEATURES].isnull().sum()

if feature_missing.sum() > 0:
    print("\nMissing values detected:")
    print(feature_missing)

    raise ValueError(
        "Selected V1 features contain missing values."
    )


# --------------------------------------------------
# Prepare X, y and groups
# --------------------------------------------------

X = df[FEATURES]
y = df[TARGET]
groups = df[GROUP_COLUMN].astype(str)


# --------------------------------------------------
# Group-aware train/test split
# --------------------------------------------------

splitter = GroupShuffleSplit(
    n_splits=1,
    test_size=0.20,
    random_state=42
)

train_idx, test_idx = next(
    splitter.split(X, y, groups=groups)
)

X_train = X.iloc[train_idx]
X_test = X.iloc[test_idx]

y_train = y.iloc[train_idx]
y_test = y.iloc[test_idx]

train_groups = set(groups.iloc[train_idx])
test_groups = set(groups.iloc[test_idx])

overlap = train_groups.intersection(test_groups)

if overlap:
    raise ValueError(
        f"Geographic leakage detected: {overlap}"
    )

print("\nTrain samples:", len(X_train))
print("Test samples:", len(X_test))
print("Train districts:", len(train_groups))
print("Test districts:", len(test_groups))
print("District overlap:", len(overlap))


# --------------------------------------------------
# Define Models
# --------------------------------------------------

models = {

    "Logistic Regression": Pipeline([
        ("scaler", StandardScaler()),
        (
            "model",
            LogisticRegression(
                max_iter=2000,
                random_state=42
            )
        )
    ]),

    "Random Forest": RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1
    ),

    "Gradient Boosting": GradientBoostingClassifier(
        random_state=42
    )
}


# --------------------------------------------------
# Train + Evaluate
# --------------------------------------------------

results = {}

best_model_name = None
best_model = None
best_score = -1


for name, model in models.items():

    print(f"\nTraining: {name}")

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    probabilities = model.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(
        y_test,
        predictions
    )

    precision = precision_score(
        y_test,
        predictions,
        zero_division=0
    )

    recall = recall_score(
        y_test,
        predictions,
        zero_division=0
    )

    f1 = f1_score(
        y_test,
        predictions,
        zero_division=0
    )

    roc_auc = roc_auc_score(
        y_test,
        probabilities
    )

    cm = confusion_matrix(
        y_test,
        predictions
    )

    results[name] = {
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(roc_auc), 4),
        "confusion_matrix": cm.tolist()
    }

    print("Accuracy :", round(accuracy, 4))
    print("Precision:", round(precision, 4))
    print("Recall   :", round(recall, 4))
    print("F1       :", round(f1, 4))
    print("ROC-AUC  :", round(roc_auc, 4))
    print("Confusion Matrix:")
    print(cm)

    # Priority:
    # Recall + F1 + ROC-AUC
    composite_score = (
        recall +
        f1 +
        roc_auc
    ) / 3

    if composite_score > best_score:

        best_score = composite_score

        best_model_name = name

        best_model = model


# --------------------------------------------------
# Save Best Model
# --------------------------------------------------

joblib.dump(
    best_model,
    MODEL_PATH
)


# --------------------------------------------------
# Save Metadata
# --------------------------------------------------

metadata = {
    "version": "v1",
    "model_name": best_model_name,
    "features": FEATURES,
    "target": TARGET,
    "group_split": GROUP_COLUMN,
    "training_samples": int(len(X_train)),
    "test_samples": int(len(X_test)),
    "metrics": results[best_model_name]
}

with open(
    METADATA_PATH,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        metadata,
        f,
        indent=4
    )


# --------------------------------------------------
# Save Evaluation Report
# --------------------------------------------------

with open(
    REPORT_PATH,
    "w",
    encoding="utf-8"
) as f:

    f.write(
        "FLASH FLOOD ML MODEL V1\n"
    )

    f.write(
        "=======================\n\n"
    )

    f.write(
        f"Total samples: {len(df)}\n"
    )

    f.write(
        f"Training samples: {len(X_train)}\n"
    )

    f.write(
        f"Test samples: {len(X_test)}\n"
    )

    f.write(
        f"Features: {len(FEATURES)}\n\n"
    )

    for name, metrics in results.items():

        f.write(
            f"{name}\n"
        )

        f.write(
            "-" * len(name) + "\n"
        )

        f.write(
            f"Accuracy: {metrics['accuracy']}\n"
        )

        f.write(
            f"Precision: {metrics['precision']}\n"
        )

        f.write(
            f"Recall: {metrics['recall']}\n"
        )

        f.write(
            f"F1: {metrics['f1']}\n"
        )

        f.write(
            f"ROC-AUC: {metrics['roc_auc']}\n"
        )

        f.write(
            f"Confusion Matrix: "
            f"{metrics['confusion_matrix']}\n\n"
        )

    f.write(
        f"Best model: {best_model_name}\n"
    )


# --------------------------------------------------
# Final Output
# --------------------------------------------------

print("\n======================================")
print("BEST MODEL:", best_model_name)
print("======================================")

print("\nModel saved to:")
print(MODEL_PATH)

print("\nMetadata saved to:")
print(METADATA_PATH)

print("\nEvaluation report saved to:")
print(REPORT_PATH)