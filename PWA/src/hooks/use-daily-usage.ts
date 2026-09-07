import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/useDevice';

export interface DailyUsage {
  id: string;
  device_id: string;
  usage_date: string;
  liters_used: number;
  percent_used: number;
  readings_count: number;
  capacity_liters_snapshot: number;
}

/** Nightly-rolled-up daily consumption for the active device (litres + percent). */
export function useDailyUsage(days = 7) {
  const { device } = useDevice();
  const [data, setData] = useState<DailyUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!device) {
      setData([]);
      setLoading(false);
      return;
    }
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data: rows } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('device_id', device.id)
      .gte('usage_date', since)
      .order('usage_date', { ascending: true });

    setData((rows as DailyUsage[]) ?? []);
    setLoading(false);
  }, [device, days]);

  useEffect(() => {
    setLoading(true);
    fetchUsage();

    const channel = supabase
      .channel(`daily_usage_realtime_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_usage' }, fetchUsage)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsage]);

  return { data, loading, refetch: fetchUsage };
}
