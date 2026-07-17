import { useState, useEffect, useCallback, useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, LogOut, Bell, Shield, Droplets, QrCode, Link2, Unlink, Pencil, Wifi, Ruler, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDevice } from '@/hooks/useDevice';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';
import QrScanner from '@/components/QrScanner';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { useNavigate } from 'react-router-dom';

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { device, loading: deviceLoading, pairDevice, unpairDevice, updateDeviceName, refetch: refetchDevice } = useDevice();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [notifications, setNotifications] = useState({
    lowWater: true,
    highTds: true,
    pumpStatus: true,
    anomaly: true,
  });
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Device pairing state
  const [systemKeyInput, setSystemKeyInput] = useState('');
  const [pairing, setPairing] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [editingDeviceName, setEditingDeviceName] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [showWifiDialog, setShowWifiDialog] = useState(false);
  const [showCalibrateDialog, setShowCalibrateDialog] = useState(false);
  const [calibHeight, setCalibHeight] = useState('');
  const [calibUnit, setCalibUnit] = useState<'inches' | 'feet'>('inches');
  const [calibBusy, setCalibBusy] = useState(false);

  const handleStartCalibration = async () => {
    if (!device) return;
    setCalibBusy(true);
    const { error } = await supabase
      .from('devices')
      .update({ calibration_mode: true, pending_command: 'calibrate' } as any)
      .eq('id', device.id);
    setCalibBusy(false);
    if (error) {
      toast.error('Failed to start calibration');
      return;
    }
    toast.success('Device entering calibration mode. Check the LCD for live distance.');
    // pre-fill with stored value
    const dev: any = device;
    if (dev.tank_height) setCalibHeight(String(dev.tank_height));
    if (dev.tank_height_unit) setCalibUnit(dev.tank_height_unit);
  };

  const handleSaveCalibration = async () => {
    if (!device) return;
    const h = parseFloat(calibHeight);
    if (isNaN(h) || h <= 0) {
      toast.error('Enter a valid tank height');
      return;
    }
    setCalibBusy(true);
    const { error } = await supabase
      .from('devices')
      .update({
        tank_height: h,
        tank_height_unit: calibUnit,
        calibration_mode: false,
        pending_command: 'beep',
      } as any)
      .eq('id', device.id);
    setCalibBusy(false);
    if (error) {
      toast.error('Failed to save tank height');
      return;
    }
    toast.success('Tank height calibrated!');
    setShowCalibrateDialog(false);
    refetchDevice();
  };


  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const p = data[0];
          setName(p.display_name || '');
          setNotifications({
            lowWater: p.low_water_alerts ?? true,
            highTds: p.high_tds_alerts ?? true,
            pumpStatus: p.pump_status_alerts ?? true,
            anomaly: p.anomaly_alerts ?? true,
          });
        }
        setLoaded(true);
      });
  }, [user]);

  const autoSave = useCallback(
    (updatedName: string, updatedNotifs: typeof notifications) => {
      if (!user || !loaded) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: updatedName,
            low_water_alerts: updatedNotifs.lowWater,
            high_tds_alerts: updatedNotifs.highTds,
            pump_status_alerts: updatedNotifs.pumpStatus,
            anomaly_alerts: updatedNotifs.anomaly,
          })
          .eq('user_id', user.id);
        if (error) {
          toast.error('Failed to save profile');
        } else {
          toast.success('Profile saved!');
        }
      }, 800);
    },
    [user, loaded],
  );

  const handleNameChange = (value: string) => {
    setName(value);
    autoSave(value, notifications);
  };

  const handleToggle = (key: keyof typeof notifications, checked: boolean) => {
    const updated = { ...notifications, [key]: checked };
    setNotifications(updated);
    autoSave(name, updated);
  };

  const handlePairDevice = async () => {
    if (!systemKeyInput.trim()) {
      toast.error('Please enter a System Key');
      return;
    }
    setPairing(true);
    const result = await pairDevice(systemKeyInput.trim());
    setPairing(false);
    if (result.success) {
      toast.success('Device paired successfully!');
      setSystemKeyInput('');
    } else {
      toast.error(result.error || 'Failed to pair device');
    }
  };

  const handleQrScan = useCallback(async (value: string) => {
    setShowQrScanner(false);
    setPairing(true);
    const result = await pairDevice(value.trim());
    setPairing(false);
    if (result.success) {
      toast.success('Device paired via QR code!');
    } else {
      toast.error(result.error || 'Failed to pair device');
    }
  }, [pairDevice]);

  const handleUnpair = async () => {
    await unpairDevice();
    toast.success('Device unpaired');
  };

  const handleSaveDeviceName = async () => {
    await updateDeviceName(deviceNameInput);
    setEditingDeviceName(false);
    toast.success('Device name updated');
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset email sent! Check your inbox.');
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-primary" /> Profile
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* User Info */}
        <div className="water-card space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Droplets className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{name || 'Water Angel User'}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Display Name</label>
              <Input value={name} onChange={e => handleNameChange(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={user?.email || ''} disabled className="mt-1" />
            </div>
          </div>
        </div>

        {/* Device Pairing */}
        <div className="water-card space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Device Pairing
          </h3>

          {deviceLoading ? (
            <div className="animate-pulse text-sm text-muted-foreground">Loading device...</div>
          ) : device ? (
            <div className="space-y-3">
              <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    {editingDeviceName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={deviceNameInput}
                          onChange={e => setDeviceNameInput(e.target.value)}
                          className="h-8 text-sm w-40"
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={handleSaveDeviceName}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDeviceName(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{device.device_name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => { setDeviceNameInput(device.device_name); setEditingDeviceName(true); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <span className="text-xs bg-safe/20 text-safe px-2 py-0.5 rounded-full font-medium">Connected</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">Key: {device.system_key}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-critical text-critical hover:bg-critical/10"
                onClick={handleUnpair}
              >
                <Unlink className="h-4 w-4 mr-2" /> Unpair Device
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Enter your device's System Key or scan the QR code to connect.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter System Key..."
                  value={systemKeyInput}
                  onChange={e => setSystemKeyInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handlePairDevice} disabled={pairing} size="sm">
                  {pairing ? '...' : 'Pair'}
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowQrScanner(true)}
              >
                <QrCode className="h-4 w-4 mr-2" /> Scan QR Code
              </Button>
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <div className="water-card space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notification Settings
          </h3>
          <PushNotificationToggle />
          {([
            { key: 'lowWater' as const, label: 'Low Water Alerts', icon: '💧' },
            { key: 'highTds' as const, label: 'High TDS Alerts', icon: '🧪' },
            { key: 'pumpStatus' as const, label: 'Pump Status Alerts', icon: '⚡' },
            { key: 'anomaly' as const, label: 'Anomaly Detection', icon: '🔍' },
          ]).map(item => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span>{item.icon}</span>
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
              <Switch
                checked={notifications[item.key]}
                onCheckedChange={checked => handleToggle(item.key, checked)}
              />
            </div>
          ))}
        </div>

        {/* Wi-Fi & Security */}
        <div className="water-card space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-primary" /> Settings
          </h3>
          <Button variant="outline" className="w-full" onClick={() => setShowWifiDialog(true)}>
            <Wifi className="h-4 w-4 mr-2" /> Change Wi-Fi
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setShowCalibrateDialog(true); }}
            disabled={!device}
          >
            <Ruler className="h-4 w-4 mr-2" /> Calibrate Height
          </Button>
          <Button variant="outline" className="w-full" onClick={handleChangePassword}>
            Change Password
          </Button>
          {isAdmin && (
            <Button variant="outline" className="w-full" onClick={() => navigate('/admin')}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Admin Panel
            </Button>
          )}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full border-critical text-critical hover:bg-critical/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </Button>

        <p className="text-center text-xs text-muted-foreground py-4">
          Water Angel v1.0 — IoT Water Monitoring
        </p>
      </div>

      {showQrScanner && (
        <QrScanner onScan={handleQrScan} onClose={() => setShowQrScanner(false)} />
      )}

      {/* Wi-Fi Change Dialog */}
      <Dialog open={showWifiDialog} onOpenChange={setShowWifiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" /> Change Device Wi-Fi
            </DialogTitle>
            <DialogDescription>
              Follow these steps to reconfigure your device's Wi-Fi connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
              <span className="text-lg">1️⃣</span>
              <p className="text-sm text-foreground">Press and hold the <strong>device button for 3 seconds</strong> to enter setup mode. The LCD will show "SETUP MODE".</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
              <span className="text-lg">2️⃣</span>
              <p className="text-sm text-foreground">Connect your phone to <span className="font-mono font-semibold text-primary">"WaterAngel_Setup"</span> Wi-Fi network.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
              <span className="text-lg">3️⃣</span>
              <p className="text-sm text-foreground">Go to the <strong>Device Setup</strong> page and enter your new Wi-Fi credentials.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowWifiDialog(false)}>
              Close
            </Button>
            <Button className="flex-1" onClick={() => { setShowWifiDialog(false); window.location.href = '/setup'; }}>
              Go to Setup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calibrate Height Dialog */}
      <Dialog open={showCalibrateDialog} onOpenChange={setShowCalibrateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5 text-primary" /> Calibrate Tank Height
            </DialogTitle>
            <DialogDescription>
              Put your device into calibration mode and measure the tank from top to bottom.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-lg bg-primary/5 text-sm space-y-1">
              <p>1. Tap <strong>Start Calibration</strong> — the device LCD will show the live distance (in inches) from the sensor to the water/tank bottom.</p>
              <p>2. With the tank <strong>empty</strong>, read the value from the LCD.</p>
              <p>3. Enter that value below and tap <strong>Save</strong>.</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleStartCalibration}
              disabled={calibBusy || !device}
            >
              Start Calibration (LCD live mode)
            </Button>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="e.g. 48"
                value={calibHeight}
                onChange={e => setCalibHeight(e.target.value)}
                className="flex-1"
              />
              <select
                value={calibUnit}
                onChange={e => setCalibUnit(e.target.value as 'inches' | 'feet')}
                className="border border-input rounded-md px-2 text-sm bg-background"
              >
                <option value="inches">Inches</option>
                <option value="feet">Feet</option>
              </select>
            </div>
            <Button className="w-full" onClick={handleSaveCalibration} disabled={calibBusy || !device}>
              {calibBusy ? 'Saving...' : 'Save Tank Height'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
