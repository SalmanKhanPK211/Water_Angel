import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDevice } from '@/hooks/useDevice';
import type { SensorData, PumpSettings, Alert } from '@/lib/water-utils';

export function useLatestSensorData() {
  const { device } = useDevice();
  const [data, setData] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    let query = supabase
      .from('sensor_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (device) query = query.eq('device_id', device.id);
    const { data: rows } = await query;
    if (rows && rows.length > 0) {
      setData(rows[0] as unknown as SensorData);
    }
    setLoading(false);
  }, [device]);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel('sensor_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, (payload) => {
        const newRow = payload.new as unknown as SensorData;
        if (!device || newRow.device_id === device.id) {
          setData(newRow);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch, device]);

  return { data, loading };
}

export function useSensorHistory(hours: number = 24) {
  const { device } = useDevice();
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from('sensor_data')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (device) query = query.eq('device_id', device.id);
    query.then(({ data: rows }) => {
      setData((rows || []) as unknown as SensorData[]);
      setLoading(false);
    });
  }, [hours, device]);

  return { data, loading };
}

export function usePumpSettings() {
  const { device } = useDevice();
  const [settings, setSettings] = useState<PumpSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!device) {
      setSettings(null);
      setLoading(false);
      return;
    }
    let query = supabase
      .from('pump_settings')
      .select('*')
      .limit(1);
    query = query.eq('device_id', device.id);
    const { data: rows } = await query;
    if (rows && rows.length > 0) {
      setSettings(rows[0] as unknown as PumpSettings);
    } else {
      setSettings(null);
    }
    setLoading(false);
  }, [device]);

  useEffect(() => {
    fetchSettings();
    const channel = supabase
      .channel('pump_settings_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pump_settings' }, (payload) => {
        const updated = payload.new as unknown as PumpSettings;
        if (!device || updated.device_id === device.id) {
          setSettings(updated);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSettings, device]);

  const updateSettings = async (updates: Partial<PumpSettings>) => {
    if (!device) return;

    const { data: updatedRows, error: updateError } = await supabase
      .from('pump_settings')
      .update(updates)
      .eq('device_id', device.id)
      .select('*');

    if (updateError) throw updateError;

    if (updatedRows && updatedRows.length > 0) {
      setSettings(updatedRows[0] as unknown as PumpSettings);
      return;
    }

    const payload: Partial<PumpSettings> & { device_id: string } = {
      device_id: device.id,
      pump_mode: settings?.pump_mode ?? 'AUTO',
      pump_status: settings?.pump_status ?? 'OFF',
      upper_threshold: settings?.upper_threshold ?? 90,
      lower_threshold: settings?.lower_threshold ?? 35,
      critical_threshold: settings?.critical_threshold ?? 25,
      ...updates,
    };

    const { data: insertedRows, error: insertError } = await supabase
      .from('pump_settings')
      .insert(payload as any)
      .select('*');

    if (insertError) throw insertError;
    if (insertedRows && insertedRows.length > 0) {
      setSettings(insertedRows[0] as unknown as PumpSettings);
    }
  };

  return { settings, loading, updateSettings, refetch: fetchSettings };
}

export function useAlerts() {
  const { device } = useDevice();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let query = supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (device) query = query.eq('device_id', device.id);
    query.then(({ data: rows }) => {
      setAlerts((rows || []) as unknown as Alert[]);
      setLoading(false);
    });

    const channel = supabase
      .channel('alerts_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const newAlert = payload.new as unknown as Alert;
        if (!device || newAlert.device_id === device.id) {
          setAlerts(prev => [newAlert, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [device]);

  return { alerts, loading };
}

export function useWeeklySensorData() {
  const { device } = useDevice();
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from('sensor_data')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (device) query = query.eq('device_id', device.id);
    query.then(({ data: rows }) => {
      setData((rows || []) as unknown as SensorData[]);
      setLoading(false);
    });
  }, [device]);

  return { data, loading };
}
