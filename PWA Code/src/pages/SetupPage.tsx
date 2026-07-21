import { useState } from 'react';
import { Wifi, Loader2, CheckCircle2, AlertCircle, Droplets, QrCode, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDevice } from '@/hooks/useDevice';
import { useNavigate } from 'react-router-dom';

type SetupStep = 'wifi' | 'pair';
type SetupStatus = 'idle' | 'sending' | 'success' | 'error';

const SetupPage = ({ onSkip }: { onSkip: () => void }) => {
  const [step, setStep] = useState<SetupStep>('wifi');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState<SetupStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [systemKey, setSystemKey] = useState('');
  const [pairStatus, setPairStatus] = useState<SetupStatus>('idle');
  const [pairError, setPairError] = useState('');

  const { pairDevice } = useDevice();
  const navigate = useNavigate();

  const handleConnect = async () => {
    if (!ssid.trim()) {
      setErrorMsg('Please enter the Wi-Fi name (SSID)');
      setWifiStatus('error');
      return;
    }
    setWifiStatus('sending');
    setErrorMsg('');
    try {
      // Use POST so credentials aren't stored in browser history or logs.
      await fetch('http://192.168.4.1/setwifi', {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, pass: password }),
        signal: AbortSignal.timeout(10000),
      });
      setWifiStatus('success');
    } catch {
      setWifiStatus('error');
      setErrorMsg('Could not reach the device. Make sure you are connected to "WaterAngel_Setup" Wi-Fi and try again.');
    }
  };

  const handlePair = async () => {
    if (!systemKey.trim()) {
      setPairError('Please enter the system key');
      setPairStatus('error');
      return;
    }
    setPairStatus('sending');
    setPairError('');
    const result = await pairDevice(systemKey);
    if (result.success) {
      setPairStatus('success');
      setTimeout(() => navigate('/'), 1500);
    } else {
      setPairStatus('error');
      setPairError(result.error || 'Failed to pair device');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Droplets className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Setup Water Angel</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'wifi' ? 'Step 1: Configure device Wi-Fi' : 'Step 2: Link your device'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          <div className={`h-2 w-12 rounded-full ${step === 'wifi' ? 'bg-primary' : 'bg-primary/30'}`} />
          <div className={`h-2 w-12 rounded-full ${step === 'pair' ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {step === 'wifi' && (
          <>
            {/* Instructions */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Wifi className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Instructions</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Connect your phone to <span className="font-mono font-semibold text-primary">"WaterAngel_Setup"</span> Wi-Fi</li>
                      <li>Enter your home Wi-Fi details below</li>
                      <li>Tap "Connect Device" to configure</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wi-Fi Form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" /> Wi-Fi Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Wi-Fi Name (SSID)</label>
                  <Input placeholder="Enter Wi-Fi name..." value={ssid} onChange={(e) => setSsid(e.target.value)} disabled={wifiStatus === 'sending'} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Password</label>
                  <Input type="password" placeholder="Enter Wi-Fi password..." value={password} onChange={(e) => setPassword(e.target.value)} disabled={wifiStatus === 'sending'} />
                </div>
                <Button className="w-full" onClick={handleConnect} disabled={wifiStatus === 'sending'}>
                  {wifiStatus === 'sending' ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</> : <><Wifi className="h-4 w-4" /> Connect Device</>}
                </Button>

                {wifiStatus === 'success' && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 rounded-lg p-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">Device configured! Proceed to pair.</p>
                  </div>
                )}
                {wifiStatus === 'error' && errorMsg && (
                  <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm">{errorMsg}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setStep('pair')}>
                Skip Wi-Fi — Already configured →
              </Button>
            </div>
          </>
        )}

        {step === 'pair' && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" /> Link Your Device
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Enter the System Key found on your Water Angel device or its packaging.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">System Key</label>
                  <Input placeholder="e.g. WA-XXXX-XXXX" value={systemKey} onChange={(e) => setSystemKey(e.target.value)} disabled={pairStatus === 'sending'} />
                </div>
                <Button className="w-full" onClick={handlePair} disabled={pairStatus === 'sending'}>
                  {pairStatus === 'sending' ? <><Loader2 className="h-4 w-4 animate-spin" /> Pairing...</> : <><QrCode className="h-4 w-4" /> Pair Device</>}
                </Button>

                {pairStatus === 'success' && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-600 rounded-lg p-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">Device paired! Redirecting...</p>
                  </div>
                )}
                {pairStatus === 'error' && pairError && (
                  <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm">{pairError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={() => setStep('wifi')} className="text-muted-foreground">
                ← Back to Wi-Fi Setup
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SetupPage;
