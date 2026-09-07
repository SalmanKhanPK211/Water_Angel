import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/useDevice';

export interface MlPrediction {
  id: string;
  device_id: string;
  prediction_type: string;
  model_version: string;
  target_time: string | null;
  target_date: string | null;
  predicted_value: number | null;
  confidence: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export function useMlPredictions() {
  const { device } = useDevice();
  const [predictions, setPredictions] = useState<MlPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPredictions = useCallback(async () => {
    if (!device) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('ml_predictions')
      .select('*')
      .eq('device_id', device.id)
      .order('created_at', { ascending: false })
      .limit(200);
    setPredictions((data || []) as unknown as MlPrediction[]);
    setLoading(false);
  }, [device]);

  useEffect(() => {
    fetchPredictions();
    if (!device) return;
    const channel = supabase
      .channel(`ml_predictions_realtime_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ml_predictions' },
        () => fetchPredictions()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPredictions, device]);

  const timeToEmpty = predictions.find(p => p.prediction_type === 'time_to_empty') || null;

  // Only ever show ONE forecast run: the newest batch, deduped by target date.
  const allDaily = predictions.filter(p => p.prediction_type === 'daily_consumption');
  const newestRun = allDaily.reduce<string | null>(
    (max, p) => (max === null || p.created_at > max ? p.created_at : max),
    null
  );
  const newestRunDay = newestRun ? newestRun.slice(0, 10) : null;
  const byTargetDate = new Map<string, MlPrediction>();
  for (const p of allDaily) {
    if (newestRunDay && p.created_at.slice(0, 10) !== newestRunDay) continue;
    const key = p.target_date || p.id;
    const existing = byTargetDate.get(key);
    if (!existing || p.created_at > existing.created_at) byTargetDate.set(key, p);
  }
  const dailyConsumption = Array.from(byTargetDate.values())
    .sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''));

  const anomalies = predictions
    .filter(p => p.prediction_type === 'anomaly')
    .sort((a, b) => (b.target_time || '').localeCompare(a.target_time || ''));

  const lastRun = predictions.length > 0
    ? predictions.reduce((max, p) => (p.created_at > max ? p.created_at : max), predictions[0].created_at)
    : null;

  return { predictions, timeToEmpty, dailyConsumption, anomalies, lastRun, loading, refetch: fetchPredictions };
}
