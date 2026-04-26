"""
SafeRoute AI — Offline Model Trainer
Trains a lightweight logistic regression, exports weights as JSON for
browser-based in-device inference (web-compatible TFLite equivalent).

Features:
  0: hour_sin       (time-of-day cyclic encoding)
  1: hour_cos
  2: is_weekend
  3: lighting       (0=dark .. 1=bright)
  4: road_type      (0=footpath, 0.33=residential, 0.66=secondary, 1=primary)
  5: crowd_density  (0-1)
  6: crime_score    (normalised historical crime count)
  7: severity_avg   (average severity of past incidents)

Label: 1 = RISKY, 0 = SAFE
"""

import json, math, random, os
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report

random.seed(42)
np.random.seed(42)

# ── Synthetic Training Data ────────────────────────────────────────────────
def gen_sample():
    hour = random.randint(0, 23)
    hour_sin = math.sin(2 * math.pi * hour / 24)
    hour_cos = math.cos(2 * math.pi * hour / 24)
    is_weekend = 1 if random.random() > 0.7 else 0
    lighting = random.uniform(0, 1)
    road_type = random.choice([0, 0.33, 0.66, 1.0])
    crowd = random.uniform(0, 1)
    crime = random.uniform(0, 1)
    severity = random.uniform(1, 5) / 5

    # Risk logic — night + dark + high crime = risky
    night = 1 if hour < 6 or hour > 21 else 0
    risk = (night * 0.35 + (1 - lighting) * 0.25 + crime * 0.25 + severity * 0.15)
    label = 1 if risk > 0.45 else 0

    return [hour_sin, hour_cos, is_weekend, lighting, road_type, crowd, crime, severity], label

print("[*] Generating training data...")
samples = [gen_sample() for _ in range(5000)]
X = np.array([s[0] for s in samples])
y = np.array([s[1] for s in samples])

# ── Feature Scaling ────────────────────────────────────────────────────────
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ── Train ──────────────────────────────────────────────────────────────────
print("[*] Training logistic regression...")
clf = LogisticRegression(max_iter=500, C=1.0)
clf.fit(X_scaled, y)

# Evaluate
y_pred = clf.predict(X_scaled)
print(classification_report(y, y_pred))

# ── Export INT8-Quantized Weights as JSON ──────────────────────────────────
SCALE = 127.0

weights_float = clf.coef_[0].tolist()
bias_float = float(clf.intercept_[0])
means = scaler.mean_.tolist()
stds  = scaler.scale_.tolist()

# Quantize to INT8
weights_int8 = [int(round(w / max(abs(max(weights_float)), 1e-6) * SCALE)) for w in weights_float]
weight_scale  = max(abs(max(weights_float)), 1e-6) / SCALE

model_json = {
    "version": "1.2.0",
    "description": "SafeRoute Offline Risk Predictor — INT8 Logistic Regression",
    "features": ["hour_sin","hour_cos","is_weekend","lighting","road_type","crowd","crime","severity"],
    "weights_int8": weights_int8,
    "weight_scale": weight_scale,
    "bias": bias_float,
    "means": means,
    "stds": stds,
    "threshold": 0.45,
    "categories": {"safe": [0, 0.3], "moderate": [0.3, 0.65], "risky": [0.65, 1.0]},
}

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "model_weights.json")
with open(OUT_PATH, "w") as f:
    json.dump(model_json, f, indent=2)

size_kb = os.path.getsize(OUT_PATH) / 1024
print(f"[OK] Exported to {OUT_PATH}  ({size_kb:.1f} KB)")
print(f"   Weights (INT8): {weights_int8}")
print(f"   Bias: {bias_float:.4f}")
