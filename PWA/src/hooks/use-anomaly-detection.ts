import { useMemo } from 'react';
import type { SensorData } from '@/lib/water-utils';

export interface DetectedAnomaly {
  id: string;
  at: string;
  severity: 'critical' | 'warning';
  reason: string;
  waterLevel: number;
  tdsValue: number;
  score: number;
}

const SUDDEN_DROP_PCT = 15;
const CRITICAL_LEVEL = 10;
const LOW_LEVEL = 20;
const TDS_CRITICAL = 600;
const TDS_WARNING = 400;
const Z_THRESHOLD = 3;

function stats(values: number[]) {
  if (values.length === 0) return { mean: 0, sd: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, sd: Math.sqrt(variance) };
}

/**
 * Rule + statistical (z-score) anomaly detection, computed in the app.
 * No trained model required.
 */
export function detectAnomalies(readings: SensorData[]): DetectedAnomaly[] {
  const ordered = [...readings].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  if (ordered.length < 3) return [];

  const tdsStats = stats(ordered.map(r => r.tds_value));
  const runtimes = ordered.map(r => r.pump_runtime ?? 0).filter(v => v > 0);
  const runtimeStats = stats(runtimes);

  const found: DetectedAnomaly[] = [];

  ordered.forEach((r, i) => {
    const prev = i > 0 ? ordered[i - 1] : null;
    const push = (severity: DetectedAnomaly['severity'], reason: string, score: number) =>
      found.push({
        id: `${r.id}-${found.length}`,
        at: r.created_at,
        severity,
        reason,
        waterLevel: r.water_level,
        tdsValue: r.tds_value,
        score: Number(score.toFixed(2)),
      });

    if (prev) {
      const drop = prev.water_level - r.water_level;
      if (drop > SUDDEN_DROP_PCT && r.pump_status !== 'ON') {
        push('critical', `Sudden ${drop.toFixed(1)}% level drop — possible leak or heavy draw`, drop);
      }
    }

    if (r.water_level <= CRITICAL_LEVEL) {
      push('critical', `Critical water level (${r.water_level.toFixed(1)}%)`, CRITICAL_LEVEL - r.water_level);
    } else if (r.water_level <= LOW_LEVEL) {
      push('warning', `Low water level (${r.water_level.toFixed(1)}%)`, LOW_LEVEL - r.water_level);
    }

    if (r.tds_value > TDS_CRITICAL) {
      push('critical', `High TDS (${Math.round(r.tds_value)} ppm) — water quality unsafe`, r.tds_value / 100);
    } else if (r.tds_value > TDS_WARNING) {
      push('warning', `Elevated TDS (${Math.round(r.tds_value)} ppm)`, r.tds_value / 100);
    } else if (tdsStats.sd > 0) {
      const z = Math.abs(r.tds_value - tdsStats.mean) / tdsStats.sd;
      if (z > Z_THRESHOLD) {
        push('warning', `TDS reading far from normal (${Math.round(r.tds_value)} ppm)`, z);
      }
    }

    const runtime = r.pump_runtime ?? 0;
    if (runtime > 0 && runtimeStats.sd > 0) {
      const z = (runtime - runtimeStats.mean) / runtimeStats.sd;
      if (z > Z_THRESHOLD) {
        push('warning', `Abnormal pump runtime (${runtime.toFixed(1)} min)`, z);
      }
    }
  });

  // Newest first, de-duplicated by reason within the same reading.
  return found
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 30);
}

export function useAnomalyDetection(readings: SensorData[]) {
  return useMemo(() => detectAnomalies(readings), [readings]);
}
