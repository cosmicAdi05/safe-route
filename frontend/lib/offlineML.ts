/**
 * SafeRoute Offline ML Engine
 * ----------------------------
 * Pure TypeScript logistic regression inference engine.
 * Loads INT8-quantized model weights from /public/model_weights.json.
 * Runs fully in-browser — NO internet required after first load.
 *
 * Equivalent to a TFLite INT8 model for web / React Native Web.
 *
 * Features (order must match training script):
 *  [0] hour_sin      — sin(2π·hour/24)
 *  [1] hour_cos      — cos(2π·hour/24)
 *  [2] is_weekend    — 0 or 1
 *  [3] lighting      — 0.0 (dark) … 1.0 (bright)
 *  [4] road_type     — 0=footpath, 0.33=residential, 0.66=secondary, 1=primary
 *  [5] crowd_density — 0.0 … 1.0
 *  [6] crime_score   — normalised historical crime count 0-1
 *  [7] severity_avg  — normalised avg severity 0-1
 */

export interface ModelWeights {
  version: string;
  features: string[];
  weights_int8: number[];
  weight_scale: number;
  bias: number;
  means: number[];
  stds: number[];
  threshold: number;
  categories: { safe: number[]; moderate: number[]; risky: number[] };
}

export interface RiskPrediction {
  score: number;           // 0-1
  confidence: number;      // 0-1
  category: "SAFE" | "MODERATE" | "RISKY";
  categoryColor: string;
  inferenceMs: number;
  isOffline: boolean;
}

export interface FeatureInput {
  hour: number;           // 0-23
  isWeekend: boolean;
  lighting: number;       // 0-1
  roadType: "footpath" | "residential" | "secondary" | "primary";
  crowdDensity: number;   // 0-1
  crimeScore: number;     // 0-1
  severityAvg: number;    // 0-1
}

// ── Road Type Encoding ──────────────────────────────────────────────────────
const ROAD_TYPE_ENC: Record<string, number> = {
  footpath: 0, residential: 0.33, secondary: 0.66, primary: 1.0,
};

// ── Module State ────────────────────────────────────────────────────────────
let cachedWeights: ModelWeights | null = null;
let loadPromise: Promise<ModelWeights> | null = null;

// ── Load Weights (cached after first call) ──────────────────────────────────
export async function loadModel(): Promise<ModelWeights> {
  if (cachedWeights) return cachedWeights;
  if (loadPromise) return loadPromise;

  loadPromise = fetch("/model_weights.json")
    .then((r) => {
      if (!r.ok) throw new Error("Model weights not found");
      return r.json() as Promise<ModelWeights>;
    })
    .then((w) => {
      cachedWeights = w;
      console.info(`[OfflineML] Loaded SafeRoute model v${w.version}`);
      return w;
    });

  return loadPromise;
}

// ── Feature Extraction ──────────────────────────────────────────────────────
export function extractFeatures(input: FeatureInput): number[] {
  const { hour, isWeekend, lighting, roadType, crowdDensity, crimeScore, severityAvg } = input;
  return [
    Math.sin((2 * Math.PI * hour) / 24),
    Math.cos((2 * Math.PI * hour) / 24),
    isWeekend ? 1 : 0,
    lighting,
    ROAD_TYPE_ENC[roadType] ?? 0.33,
    crowdDensity,
    crimeScore,
    severityAvg,
  ];
}

// ── Normalise ───────────────────────────────────────────────────────────────
function normalise(features: number[], means: number[], stds: number[]): number[] {
  return features.map((f, i) => (f - means[i]) / (stds[i] || 1));
}

// ── Sigmoid ─────────────────────────────────────────────────────────────────
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// ── Main Inference ───────────────────────────────────────────────────────────
export async function predictRisk(input: FeatureInput): Promise<RiskPrediction> {
  const t0 = performance.now();

  // Load or use cached model
  const weights = await loadModel();

  // Extract, normalise features
  const raw = extractFeatures(input);
  const norm = normalise(raw, weights.means, weights.stds);

  // Dequantize INT8 weights
  const wFloat = weights.weights_int8.map((w) => w * weights.weight_scale);

  // Dot product + bias → sigmoid
  const logit = norm.reduce((sum, f, i) => sum + f * wFloat[i], weights.bias);
  const score = sigmoid(logit);

  // Confidence = distance from decision boundary (0.5)
  const confidence = Math.min(Math.abs(score - 0.5) * 2, 1);

  // Categorise
  const { risky, moderate } = weights.categories;
  let category: "SAFE" | "MODERATE" | "RISKY";
  let categoryColor: string;
  if (score >= risky[0]) {
    category = "RISKY"; categoryColor = "#ef4444";
  } else if (score >= moderate[0]) {
    category = "MODERATE"; categoryColor = "#f59e0b";
  } else {
    category = "SAFE"; categoryColor = "#22c55e";
  }

  return {
    score,
    confidence,
    category,
    categoryColor,
    inferenceMs: +(performance.now() - t0).toFixed(2),
    isOffline: true,
  };
}

// ── Batch Scoring for Route Segments ────────────────────────────────────────
export async function scoreRoute(
  segments: FeatureInput[]
): Promise<{ avgScore: number; maxScore: number; breakdown: RiskPrediction[] }> {
  const predictions = await Promise.all(segments.map(predictRisk));
  const scores = predictions.map((p) => p.score);
  return {
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    maxScore: Math.max(...scores),
    breakdown: predictions,
  };
}

// ── A* Cost Function ─────────────────────────────────────────────────────────
/**
 * Computes edge cost for A* / Dijkstra routing.
 * final_cost = distance_km * (1 + risk_score * safety_weight)
 */
export function routeCost(
  distanceKm: number,
  riskScore: number,
  safetyWeight = 5
): number {
  return distanceKm * (1 + riskScore * safetyWeight);
}
