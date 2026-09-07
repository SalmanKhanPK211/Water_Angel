import { useState, useEffect, useRef } from 'react';
import { usePumpSettings, useLatestSensorData } from '@/hooks/use-water-data';
import { useDevice } from '@/hooks/useDevice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Power, PowerOff, Settings2, Ruler, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const ControlPage = () => {
  const { device } = useDevice();
  const { settings, loading, updateSettings } = usePumpSettings();
  const { data: latestSensor } = useLatestSensorData();
  const [isAuto, setIsAuto] = useState(true);
  const [upper, setUpper] = useState(90);
  const [lower, setLower] = useState(35);
  const [critical, setCritical] = useState(25);
  const [saving, setSaving] = useState(false);
  const [tankHeight, setTankHeight] = useState('');
  const [tankUnit, setTankUnit] = useState<'inches' | 'feet'>('inches');
  const [savingTank, setSavingTank] = useState(false);

  const lastPumpStatusRef = useRef<string | null>(null);

  // Toast when ESP32 reports a pump_status change via sensor_data
  useEffect(() => {
    if (!latestSensor) return;
    const newStatus = latestSensor.pump_status;
    if (lastPumpStatusRef.current !== null && lastPumpStatusRef.current !== newStatus) {
      toast.success(`Pump is now ${newStatus}`, { description: 'Confirmed by device' });
    }
    lastPumpStatusRef.current = newStatus;
  }, [latestSensor]);

  // Load tank height from device
  useEffect(() => {
    if (device) {
      supabase
        .from('devices')
        .select('tank_height, tank_height_unit')
        .eq('id', device.id)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const d = data[0] as any;
            if (d.tank_height) setTankHeight(String(d.tank_height));
            if (d.tank_height_unit) setTankUnit(d.tank_height_unit);
          }
        });
    }
  }, [device]);

  useEffect(() => {
    if (settings) {
      setIsAuto(settings.pump_mode === 'AUTO');
      setUpper(settings.upper_threshold);
      setLower(settings.lower_threshold);
      setCritical(settings.critical_threshold);
    }
  }, [settings]);

  const handleModeChange = async (auto: boolean) => {
    setIsAuto(auto);
    try {
      await updateSettings({ pump_mode: auto ? 'AUTO' : 'MANUAL' });
    } catch (error) {
      setIsAuto(!auto);
      toast.error(error instanceof Error ? error.message : 'Failed to change pump mode');
      return;
    }
    toast.success(`Pump mode set to ${auto ? 'AUTO' : 'MANUAL'}`);
  };

  const handleSaveThresholds = async () => {
    if (upper <= lower || lower <= critical) {
      toast.error('Invalid thresholds: Upper > Lower > Critical required');
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        upper_threshold: upper,
        lower_threshold: lower,
        critical_threshold: critical,
      });
    } catch (error) {
      setSaving(false);
      toast.error(error instanceof Error ? error.message : 'Failed to update thresholds');
      return;
    }
    setSaving(false);
    toast.success('Thresholds updated successfully');
  };

  const handleManualPump = async (status: 'ON' | 'OFF') => {
    if (!device) {
      toast.error('No device paired');
      return;
    }
    try {
      // 1. Persist the commanded state (source of truth the firmware polls)
      await updateSettings({ pump_mode: 'MANUAL', pump_status: status });
      setIsAuto(false);

      // 2. Queue the command on the device row so firmware can react immediately
      const { error: cmdError } = await supabase
        .from('devices')
        .update({ pending_command: status === 'ON' ? 'pump_on' : 'pump_off' } as any)
        .eq('id', device.id);

      if (cmdError) throw cmdError;

      toast.success(`Pump ${status} command sent`, {
        description: 'Waiting for the device to apply it',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to turn pump ${status}`);
    }
  };


  const handleSaveTankHeight = async () => {
    if (!device) {
      toast.error('No device paired');
      return;
    }
    const height = parseFloat(tankHeight);
    if (isNaN(height) || height <= 0) {
      toast.error('Please enter a valid tank height');
      return;
    }
    setSavingTank(true);
    const { error } = await supabase
      .from('devices')
      .update({ tank_height: height, tank_height_unit: tankUnit } as any)
      .eq('id', device.id);
    setSavingTank(false);
    if (error) {
      toast.error('Failed to save tank height');
    } else {
      toast.success('Tank height saved!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> Pump Control
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Mode Toggle */}
        <div className="water-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pump Mode</h3>
              <p className="text-xs text-muted-foreground">
                {isAuto ? 'Pump operates automatically based on thresholds' : 'Manual pump control'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">MANUAL</span>
              <Switch checked={isAuto} onCheckedChange={handleModeChange} />
              <span className="text-xs text-muted-foreground">AUTO</span>
            </div>
          </div>
        </div>

        {/* Manual Controls */}
        {!isAuto && (
          <div className="water-card space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Manual Control</h3>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    settings?.pump_status === 'ON'
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground text-muted-foreground'
                  }
                >
                  Commanded: {settings?.pump_status === 'ON' ? 'ON' : 'OFF'}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    latestSensor?.pump_status === 'ON'
                      ? 'border-safe text-safe'
                      : 'border-muted-foreground text-muted-foreground'
                  }
                >
                  {latestSensor?.pump_status === 'ON' ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Device ON</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" /> Device OFF</>
                  )}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleManualPump('ON')}
                className="h-20 text-lg bg-safe hover:bg-safe/90 text-safe-foreground"
              >
                <Power className="h-6 w-6 mr-2" />
                Turn ON
              </Button>
              <Button
                onClick={() => handleManualPump('OFF')}
                variant="outline"
                className="h-20 text-lg border-critical text-critical hover:bg-critical/10"
              >
                <PowerOff className="h-6 w-6 mr-2" />
                Turn OFF
              </Button>
            </div>

          </div>
        )}

        {/* Tank Height */}
        <div className="water-card space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" /> Tank Height
          </h3>
          <p className="text-xs text-muted-foreground">
            Enter your water tank height for accurate level calculations.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="e.g. 48"
              value={tankHeight}
              onChange={e => setTankHeight(e.target.value)}
              className="flex-1"
              min="1"
            />
            <Select value={tankUnit} onValueChange={(v) => setTankUnit(v as 'inches' | 'feet')}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inches">Inches</SelectItem>
                <SelectItem value="feet">Feet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tankUnit === 'feet' && tankHeight && !isNaN(parseFloat(tankHeight)) && (
            <p className="text-xs text-muted-foreground">
              = {(parseFloat(tankHeight) * 12).toFixed(0)} inches
            </p>
          )}
          {tankUnit === 'inches' && tankHeight && !isNaN(parseFloat(tankHeight)) && parseFloat(tankHeight) >= 12 && (
            <p className="text-xs text-muted-foreground">
              = {(parseFloat(tankHeight) / 12).toFixed(1)} feet
            </p>
          )}
          <Button onClick={handleSaveTankHeight} disabled={savingTank || !device} className="w-full">
            {savingTank ? 'Saving...' : 'Save Tank Height'}
          </Button>
        </div>

        {/* Threshold Settings */}
        <div className="water-card space-y-5">
          <h3 className="text-sm font-semibold text-foreground">Threshold Settings</h3>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Upper Threshold (Pump OFF)</span>
              <span className="text-sm font-semibold status-safe">{upper}%</span>
            </div>
            <Slider
              value={[upper]}
              onValueChange={([v]) => setUpper(v)}
              max={100}
              min={50}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Lower Threshold (Pump ON)</span>
              <span className="text-sm font-semibold status-warning">{lower}%</span>
            </div>
            <Slider
              value={[lower]}
              onValueChange={([v]) => setLower(v)}
              max={49}
              min={20}
              step={5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Critical Threshold (Alert)</span>
              <span className="text-sm font-semibold status-critical">{critical}%</span>
            </div>
            <Slider
              value={[critical]}
              onValueChange={([v]) => setCritical(v)}
              max={19}
              min={5}
              step={5}
            />
          </div>

          <Button onClick={handleSaveThresholds} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Thresholds'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ControlPage;
