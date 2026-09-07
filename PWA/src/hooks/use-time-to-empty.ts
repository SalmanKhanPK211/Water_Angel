import { useMemo } from 'react';
import { useSensorHistory, useLatestSensorData } from '@/hooks/use-water-data';
import type { SensorData } from '@/lib/water-utils';

export interface TimeToEmptyResult {
  /** 'ok' | 'idle' (no measurable usage) | 'collecting' (not enough data) */
  state: 'ok' | 'idle' | 'collecting';
  /** Hours until empty, null unless state === 'ok'. Uncapped. */
  hours: number | null;
  /** Ready-to-render label, e.g. "6 h 20 m", "> 48 h", "No usage detected". */
  label: string;
  /** Estimated clock time the tank hits 0%, null unless state === 'ok'. */
  emptyAt: Date | null;
  /** Median drain rate in percent per hour (0 when idle). */
  drainRatePctPerHour: number;
  /** Current (median-filtered) level percentage. */
  currentLevel: number;
  /** How many usable (consumption) deltas were found. */
  usableDeltas: number;
  /** How many raw readings were available in the window. */
  readings: number;
}

const WINDOW_HOURS = 6;
/** Minimum usable drop measurements before we trust a rate. */
const MIN_DELTAS = 3;
/** Skip pairs further apart than this (device was offline). */
const MAX_GAP_HOURS = 2;
const MAX_DISPLAY_HOURS = 48;
/** Below this the tank is considered idle — never divide by it. */
const MIN_RATE_PCT_PER_HOUR = 0.05;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 5-point median filter over the level series (edges use the available window). */
function medianFilter(levels: number[], size = 5): number[] {
  const half = Math.floor(size / 2);
  return levels.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(levels.length, i + half + 1);
    return median(levels.slice(start, end));
  });
}

function formatHours(hours: number): string {
  if (hours >= MAX_DISPLAY_HOURS) return `> ${MAX_DISPLAY_HOURS} h`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${Math.max(m, 1)} m`;
  return m > 0 ? `${h} h ${m} m` : `${h} h`;
}

export function computeTimeToEmpty(readings: SensorData[]): TimeToEmptyResult {
  const ordered = [...readings].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const empty: TimeToEmptyResult = {
    state: 'collecting',
    hours: null,
    label: 'Collecting data',
    emptyAt: null,
    drainRatePctPerHour: 0,
    currentLevel: ordered.length ? ordered[ordered.length - 1].water_level : 0,
    usableDeltas: 0,
    readings: ordered.length,
  };

  if (ordered.length < MIN_DELTAS + 1) return empty;

  const filtered = medianFilter(ordered.map(r => r.water_level));
  const currentLevel = filtered[filtered.length - 1];

  // Consumption deltas only: negative level change, pump not running on either sample.
  const rates: number[] = [];
  for (let i = 1; i < filtered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    if (prev.pump_status === 'ON' || curr.pump_status === 'ON') continue; // refilling

    const delta = filtered[i] - filtered[i - 1];
    if (delta >= 0) continue; // refill / noise upward — discard

    const hoursGap =
      (new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()) / 3_600_000;
    if (hoursGap <= 0 || hoursGap > MAX_GAP_HOURS) continue; // ignore zero/huge gaps

    rates.push(-delta / hoursGap); // percent per hour, positive
  }

  if (rates.length < MIN_DELTAS) {
    return {
      ...empty,
      state: rates.length === 0 ? 'idle' : 'collecting',
      label: rates.length === 0 ? 'No usage detected' : 'Collecting data',
      currentLevel,
      usableDeltas: rates.length,
    };
  }

  const rate = median(rates);

  if (rate < MIN_RATE_PCT_PER_HOUR) {
    return {
      state: 'idle',
      hours: null,
      label: 'No usage detected',
      emptyAt: null,
      drainRatePctPerHour: 0,
      currentLevel,
      usableDeltas: rates.length,
      readings: ordered.length,
    };
  }

  const hours = currentLevel / rate;
  return {
    state: 'ok',
    hours,
    label: formatHours(hours),
    emptyAt: new Date(Date.now() + hours * 3_600_000),
    drainRatePctPerHour: rate,
    currentLevel,
    usableDeltas: rates.length,
    readings: ordered.length,
  };
}

/** Real-time, client-side time-to-empty from the last ~6 h of readings. */
export function useTimeToEmpty(): TimeToEmptyResult {
  const { data: history } = useSensorHistory(WINDOW_HOURS);
  const { data: latest } = useLatestSensorData();

  return useMemo(() => {
    const merged =
      latest && !history.some(r => r.id === latest.id) ? [...history, latest] : history;
    return computeTimeToEmpty(merged);
  }, [history, latest]);
}
