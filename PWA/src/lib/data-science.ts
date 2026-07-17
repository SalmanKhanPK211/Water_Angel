/**
 * Data Science Utilities for Water Angel
 * Implements: Linear Regression, K-Means Clustering, Correlation Analysis, Classification
 */

import type { SensorData } from './water-utils';

// ==================== LINEAR REGRESSION ====================

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  predict: (x: number) => number;
}

export function linearRegression(xValues: number[], yValues: number[]): RegressionResult {
  const n = xValues.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0, predict: () => 0 };

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((s, x, i) => s + x * yValues[i], 0);
  const sumX2 = xValues.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssRes = yValues.reduce((s, y, i) => s + (y - (slope * xValues[i] + intercept)) ** 2, 0);
  const ssTot = yValues.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared, predict: (x: number) => slope * x + intercept };
}

// ==================== CORRELATION ====================

export interface CorrelationResult {
  coefficient: number; // Pearson r (-1 to 1)
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'positive' | 'negative' | 'none';
  regression: RegressionResult;
  scatterData: { x: number; y: number; predicted: number }[];
}

export function correlationAnalysis(
  data: SensorData[],
  xKey: 'water_level' | 'tds_value' | 'pump_runtime',
  yKey: 'water_level' | 'tds_value' | 'pump_runtime'
): CorrelationResult {
  const xValues = data.map(d => d[xKey]);
  const yValues = data.map(d => d[yKey]);
  const n = xValues.length;

  if (n < 3) {
    return {
      coefficient: 0, strength: 'none', direction: 'none',
      regression: { slope: 0, intercept: 0, rSquared: 0, predict: () => 0 },
      scatterData: [],
    };
  }

  const meanX = xValues.reduce((a, b) => a + b, 0) / n;
  const meanY = yValues.reduce((a, b) => a + b, 0) / n;

  let sumXYDev = 0, sumX2Dev = 0, sumY2Dev = 0;
  for (let i = 0; i < n; i++) {
    const dx = xValues[i] - meanX;
    const dy = yValues[i] - meanY;
    sumXYDev += dx * dy;
    sumX2Dev += dx * dx;
    sumY2Dev += dy * dy;
  }

  const denominator = Math.sqrt(sumX2Dev * sumY2Dev);
  const coefficient = denominator === 0 ? 0 : sumXYDev / denominator;

  const absR = Math.abs(coefficient);
  const strength: CorrelationResult['strength'] =
    absR >= 0.7 ? 'strong' : absR >= 0.4 ? 'moderate' : absR >= 0.2 ? 'weak' : 'none';
  const direction: CorrelationResult['direction'] =
    coefficient > 0.05 ? 'positive' : coefficient < -0.05 ? 'negative' : 'none';

  const regression = linearRegression(xValues, yValues);

  const scatterData = data.map(d => ({
    x: d[xKey],
    y: d[yKey],
    predicted: regression.predict(d[xKey]),
  }));

  return { coefficient, strength, direction, regression, scatterData };
}

// ==================== PREDICTIVE FORECASTING ====================

export interface ForecastResult {
  hoursUntilEmpty: number | null;
  hoursUntilFull: number | null;
  predictedLevels: { hour: number; level: number; label: string }[];
  confidence: 'high' | 'medium' | 'low';
  trendDirection: 'falling' | 'rising' | 'stable';
  ratePerHour: number; // % per hour (negative = falling)
}

export function predictiveForecasting(data: SensorData[], forecastHours: number = 24): ForecastResult {
  if (data.length < 5) {
    return {
      hoursUntilEmpty: null, hoursUntilFull: null,
      predictedLevels: [], confidence: 'low',
      trendDirection: 'stable', ratePerHour: 0,
    };
  }

  // Convert timestamps to hours from first reading
  const t0 = new Date(data[0].created_at).getTime();
  const xHours = data.map(d => (new Date(d.created_at).getTime() - t0) / 3600000);
  const yLevels = data.map(d => d.water_level);

  // Weighted linear regression (recent data weighted more)
  const n = xHours.length;
  const weights = xHours.map((_, i) => 1 + (i / n) * 2); // weight 1-3, more recent = higher
  const totalW = weights.reduce((a, b) => a + b, 0);

  const wMeanX = xHours.reduce((s, x, i) => s + weights[i] * x, 0) / totalW;
  const wMeanY = yLevels.reduce((s, y, i) => s + weights[i] * y, 0) / totalW;

  let wSumXY = 0, wSumX2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xHours[i] - wMeanX;
    wSumXY += weights[i] * dx * (yLevels[i] - wMeanY);
    wSumX2 += weights[i] * dx * dx;
  }

  const slope = wSumX2 === 0 ? 0 : wSumXY / wSumX2;
  const intercept = wMeanY - slope * wMeanX;

  // Calculate R² for confidence
  const reg = linearRegression(xHours, yLevels);
  const confidence: ForecastResult['confidence'] =
    reg.rSquared >= 0.7 ? 'high' : reg.rSquared >= 0.4 ? 'medium' : 'low';

  const lastHour = xHours[n - 1];
  const currentLevel = yLevels[n - 1];

  // Predict future levels
  const predictedLevels: ForecastResult['predictedLevels'] = [];
  for (let h = 0; h <= forecastHours; h += 1) {
    const futureHour = lastHour + h;
    let level = slope * futureHour + intercept;
    level = Math.max(0, Math.min(100, level));
    const futureTime = new Date(Date.now() + h * 3600000);
    predictedLevels.push({
      hour: h,
      level: Math.round(level * 10) / 10,
      label: futureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }

  // Time until empty/full
  let hoursUntilEmpty: number | null = null;
  let hoursUntilFull: number | null = null;

  if (slope < -0.01) {
    hoursUntilEmpty = Math.round(currentLevel / Math.abs(slope));
    if (hoursUntilEmpty > 720) hoursUntilEmpty = null; // cap at 30 days
  }
  if (slope > 0.01) {
    hoursUntilFull = Math.round((100 - currentLevel) / slope);
    if (hoursUntilFull > 720) hoursUntilFull = null;
  }

  const trendDirection: ForecastResult['trendDirection'] =
    slope < -0.1 ? 'falling' : slope > 0.1 ? 'rising' : 'stable';

  return {
    hoursUntilEmpty,
    hoursUntilFull,
    predictedLevels,
    confidence,
    trendDirection,
    ratePerHour: Math.round(slope * 100) / 100,
  };
}

// ==================== K-MEANS CLUSTERING ====================

export interface UsageCluster {
  id: number;
  label: string;
  centroidHour: number;
  centroidUsage: number;
  points: { hour: number; usage: number; day: string }[];
  color: string;
}

export function clusterUsagePatterns(data: SensorData[], k: number = 3): UsageCluster[] {
  // Extract hourly usage patterns
  const hourlyUsage: { hour: number; usage: number; day: string }[] = [];

  for (let i = 1; i < data.length; i++) {
    const drop = data[i - 1].water_level - data[i].water_level;
    if (drop > 0) {
      const date = new Date(data[i].created_at);
      hourlyUsage.push({
        hour: date.getHours(),
        usage: Math.round(drop * 10) / 10,
        day: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    }
  }

  if (hourlyUsage.length < k) {
    return [{
      id: 0, label: 'All Usage', centroidHour: 12, centroidUsage: 0,
      points: hourlyUsage, color: 'hsl(var(--primary))',
    }];
  }

  // Normalize features
  const maxHour = 24;
  const maxUsage = Math.max(...hourlyUsage.map(p => p.usage), 1);

  const normalized = hourlyUsage.map(p => ({
    ...p,
    nHour: p.hour / maxHour,
    nUsage: p.usage / maxUsage,
  }));

  // Initialize centroids (k-means++)
  const centroids: { nHour: number; nUsage: number }[] = [];
  centroids.push(normalized[Math.floor(Math.random() * normalized.length)]);

  for (let c = 1; c < k; c++) {
    const distances = normalized.map(p => {
      const minDist = centroids.reduce((min, cent) => {
        const d = Math.sqrt((p.nHour - cent.nHour) ** 2 + (p.nUsage - cent.nUsage) ** 2);
        return Math.min(min, d);
      }, Infinity);
      return minDist * minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalDist;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) { centroids.push(normalized[i]); break; }
    }
  }

  // Iterate
  const assignments = new Array(normalized.length).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    // Assign points
    for (let i = 0; i < normalized.length; i++) {
      let minDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = Math.sqrt(
          (normalized[i].nHour - centroids[c].nHour) ** 2 +
          (normalized[i].nUsage - centroids[c].nUsage) ** 2
        );
        if (d < minDist) { minDist = d; assignments[i] = c; }
      }
    }

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = normalized.filter((_, i) => assignments[i] === c);
      if (members.length > 0) {
        centroids[c] = {
          nHour: members.reduce((s, p) => s + p.nHour, 0) / members.length,
          nUsage: members.reduce((s, p) => s + p.nUsage, 0) / members.length,
        };
      }
    }
  }

  const clusterColors = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--safe))', 'hsl(var(--accent))'];
  const clusterLabels = ['Morning Usage', 'Afternoon Usage', 'Evening Usage', 'Night Usage'];

  // Build clusters sorted by centroid hour
  const clusters: UsageCluster[] = [];
  for (let c = 0; c < k; c++) {
    const points = hourlyUsage.filter((_, i) => assignments[i] === c);
    if (points.length === 0) continue;
    clusters.push({
      id: c,
      label: '',
      centroidHour: Math.round(centroids[c].nHour * maxHour),
      centroidUsage: Math.round(centroids[c].nUsage * maxUsage * 10) / 10,
      points,
      color: clusterColors[c % clusterColors.length],
    });
  }

  clusters.sort((a, b) => a.centroidHour - b.centroidHour);
  clusters.forEach((cl, i) => {
    cl.label = clusterLabels[i] || `Cluster ${i + 1}`;
  });

  return clusters;
}

// ==================== PUMP HEALTH CLASSIFICATION ====================

export interface PumpHealthResult {
  status: 'healthy' | 'degrading' | 'critical';
  score: number; // 0-100
  factors: { name: string; value: string; status: 'good' | 'warning' | 'bad' }[];
  recommendation: string;
}

export function classifyPumpHealth(data: SensorData[]): PumpHealthResult {
  const pumpOnData = data.filter(d => d.pump_status === 'ON');
  const factors: PumpHealthResult['factors'] = [];
  let score = 100;

  if (pumpOnData.length < 3) {
    return {
      status: 'healthy', score: 100,
      factors: [{ name: 'Data Points', value: 'Insufficient data', status: 'warning' }],
      recommendation: 'Need more pump activity data for accurate health assessment.',
    };
  }

  // Factor 1: Pump duty cycle (% of time pump is ON)
  const dutyCycle = (pumpOnData.length / data.length) * 100;
  if (dutyCycle > 60) {
    score -= 30;
    factors.push({ name: 'Duty Cycle', value: `${dutyCycle.toFixed(1)}%`, status: 'bad' });
  } else if (dutyCycle > 40) {
    score -= 15;
    factors.push({ name: 'Duty Cycle', value: `${dutyCycle.toFixed(1)}%`, status: 'warning' });
  } else {
    factors.push({ name: 'Duty Cycle', value: `${dutyCycle.toFixed(1)}%`, status: 'good' });
  }

  // Factor 2: Runtime consistency (std deviation of pump runtimes)
  const runtimes = pumpOnData.map(d => d.pump_runtime).filter(r => r > 0);
  if (runtimes.length >= 2) {
    const avgRuntime = runtimes.reduce((a, b) => a + b, 0) / runtimes.length;
    const stdDev = Math.sqrt(runtimes.reduce((s, r) => s + (r - avgRuntime) ** 2, 0) / runtimes.length);
    const cv = avgRuntime > 0 ? (stdDev / avgRuntime) * 100 : 0; // coefficient of variation

    if (cv > 80) {
      score -= 25;
      factors.push({ name: 'Runtime Consistency', value: `High variance (CV: ${cv.toFixed(0)}%)`, status: 'bad' });
    } else if (cv > 50) {
      score -= 10;
      factors.push({ name: 'Runtime Consistency', value: `Moderate variance (CV: ${cv.toFixed(0)}%)`, status: 'warning' });
    } else {
      factors.push({ name: 'Runtime Consistency', value: `Stable (CV: ${cv.toFixed(0)}%)`, status: 'good' });
    }

    // Factor 3: Average runtime trend (is it increasing?)
    const halfIdx = Math.floor(runtimes.length / 2);
    const firstHalfAvg = runtimes.slice(0, halfIdx).reduce((a, b) => a + b, 0) / halfIdx;
    const secondHalfAvg = runtimes.slice(halfIdx).reduce((a, b) => a + b, 0) / (runtimes.length - halfIdx);

    if (secondHalfAvg > firstHalfAvg * 1.5) {
      score -= 20;
      factors.push({ name: 'Runtime Trend', value: `Increasing (+${((secondHalfAvg / firstHalfAvg - 1) * 100).toFixed(0)}%)`, status: 'bad' });
    } else if (secondHalfAvg > firstHalfAvg * 1.2) {
      score -= 10;
      factors.push({ name: 'Runtime Trend', value: `Slightly increasing`, status: 'warning' });
    } else {
      factors.push({ name: 'Runtime Trend', value: `Stable`, status: 'good' });
    }
  }

  // Factor 4: Pump cycling frequency (rapid on/off)
  let rapidCycles = 0;
  for (let i = 2; i < data.length; i++) {
    if (data[i].pump_status !== data[i - 1].pump_status && data[i - 1].pump_status !== data[i - 2].pump_status) {
      const timeDiff = (new Date(data[i].created_at).getTime() - new Date(data[i - 2].created_at).getTime()) / 60000;
      if (timeDiff < 5) rapidCycles++;
    }
  }

  if (rapidCycles > 5) {
    score -= 20;
    factors.push({ name: 'Rapid Cycling', value: `${rapidCycles} events detected`, status: 'bad' });
  } else if (rapidCycles > 2) {
    score -= 10;
    factors.push({ name: 'Rapid Cycling', value: `${rapidCycles} events`, status: 'warning' });
  } else {
    factors.push({ name: 'Rapid Cycling', value: `None`, status: 'good' });
  }

  score = Math.max(0, Math.min(100, score));

  const status: PumpHealthResult['status'] = score >= 70 ? 'healthy' : score >= 40 ? 'degrading' : 'critical';

  const recommendations: Record<PumpHealthResult['status'], string> = {
    healthy: 'Pump is operating within normal parameters. Continue regular monitoring.',
    degrading: 'Pump showing signs of wear. Schedule maintenance inspection soon.',
    critical: 'Pump health is critical. Immediate maintenance required to prevent failure.',
  };

  return { status, score, factors, recommendation: recommendations[status] };
}
