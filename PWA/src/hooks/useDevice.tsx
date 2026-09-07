import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Device {
  id: string;
  system_key: string;
  device_name: string;
  created_at: string;
  capacity_liters: number | null;
}

interface DeviceContextType {
  device: Device | null;
  loading: boolean;
  pairDevice: (systemKey: string) => Promise<{ success: boolean; error?: string }>;
  unpairDevice: () => Promise<void>;
  updateDeviceName: (name: string) => Promise<void>;
  updateCapacity: (liters: number) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType>({
  device: null,
  loading: true,
  pairDevice: async () => ({ success: false }),
  unpairDevice: async () => {},
  updateDeviceName: async () => {},
  updateCapacity: async () => ({ success: false }),
  refetch: async () => {},
});


export const useDevice = () => useContext(DeviceContext);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDevice = useCallback(async () => {
    if (!user) {
      setDevice(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);
    if (data && data.length > 0) {
      setDevice(data[0] as unknown as Device);
    } else {
      setDevice(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  const pairDevice = async (systemKey: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };

    // Check if user already has a device
    if (device) return { success: false, error: 'You already have a device paired. Unpair it first.' };

    // Look up the device by system_key
    const { data: devices, error: lookupError } = await supabase
      .from('devices')
      .select('*')
      .eq('system_key', systemKey.trim())
      .limit(1);

    if (lookupError) return { success: false, error: lookupError.message };
    if (!devices || devices.length === 0) return { success: false, error: 'Invalid System Key. Device not found.' };

    const target = devices[0];
    if (target.user_id && target.user_id !== user.id) {
      return { success: false, error: 'This device is already paired to another account.' };
    }

    // Claim the device
    const { error: updateError } = await supabase
      .from('devices')
      .update({ user_id: user.id })
      .eq('id', target.id);

    if (updateError) return { success: false, error: updateError.message };

    await fetchDevice();
    return { success: true };
  };

  const unpairDevice = async () => {
    if (!device || !user) return;
    await supabase
      .from('devices')
      .update({ user_id: null })
      .eq('id', device.id);
    setDevice(null);
  };

  const updateDeviceName = async (name: string) => {
    if (!device) return;
    await supabase
      .from('devices')
      .update({ device_name: name })
      .eq('id', device.id);
    setDevice(prev => prev ? { ...prev, device_name: name } : null);
  };

  const updateCapacity = async (liters: number): Promise<{ success: boolean; error?: string }> => {
    if (!device) return { success: false, error: 'No device paired' };
    if (!Number.isFinite(liters) || liters < 50 || liters > 1_000_000) {
      return { success: false, error: 'Enter a capacity between 50 and 1,000,000 litres' };
    }
    const value = Math.round(liters);
    const { error } = await supabase
      .from('devices')
      .update({ capacity_liters: value } as any)
      .eq('id', device.id);
    if (error) return { success: false, error: error.message };
    setDevice(prev => prev ? { ...prev, capacity_liters: value } : null);
    return { success: true };
  };

  return (
    <DeviceContext.Provider value={{ device, loading, pairDevice, unpairDevice, updateDeviceName, updateCapacity, refetch: fetchDevice }}>
      {children}
    </DeviceContext.Provider>
  );
};

