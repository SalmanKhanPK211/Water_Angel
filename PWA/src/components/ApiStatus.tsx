import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface ApiStatusProps {
  lastUpdate: string | null;
}

const ApiStatus = ({ lastUpdate }: ApiStatusProps) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // ESP32 posts every 30s. Allow ~2 missed cycles before flagging Delayed/Offline.
  const getStatus = () => {
    if (!lastUpdate) return { label: 'No data', color: 'text-muted-foreground', icon: WifiOff, dot: 'bg-muted-foreground' };
    const diff = (Date.now() - new Date(lastUpdate).getTime()) / 1000;
    if (diff < 75) return { label: 'Online', color: 'status-safe', icon: Wifi, dot: 'bg-[hsl(var(--safe))]' };
    if (diff < 180) return { label: 'Delayed', color: 'status-warning', icon: Wifi, dot: 'bg-[hsl(var(--warning))]' };
    return { label: 'Offline', color: 'text-destructive', icon: WifiOff, dot: 'bg-destructive' };
  };

  const status = getStatus();
  const Icon = status.icon;
  const timeAgo = lastUpdate ? formatTimeAgo(new Date(lastUpdate)) : 'Never';

  return (
    <div className="water-card flex items-center justify-between py-3 px-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${status.dot} animate-pulse`} />
        <Icon className={`h-4 w-4 ${status.color}`} />
        <span className={`text-sm font-medium ${status.color}`}>ESP32: {status.label}</span>
      </div>
      <span className="text-xs text-muted-foreground">Last: {timeAgo}</span>
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default ApiStatus;
