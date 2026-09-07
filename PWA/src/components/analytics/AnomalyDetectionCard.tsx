import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAnomalyDetection } from '@/hooks/use-anomaly-detection';
import type { SensorData } from '@/lib/water-utils';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Props {
  history: SensorData[];
}

const AnomalyDetectionCard = ({ history }: Props) => {
  const anomalies = useAnomalyDetection(history);

  return (
    <div className="water-card space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {anomalies.length === 0 ? (
            <ShieldCheck className="h-4 w-4 status-safe" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-warning" />
          )}
          Anomaly Detection
        </h3>
        <span className="text-[10px] text-muted-foreground">Live · in-app rules</span>
      </div>

      {anomalies.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing unusual in the recent readings — levels, TDS and pump runtime all look normal.
        </p>
      ) : (
        <div className="space-y-2">
          {anomalies.slice(0, 8).map(a => (
            <div
              key={a.id}
              className={`border-l-4 ${
                a.severity === 'critical' ? 'border-l-critical' : 'border-l-warning'
              } bg-muted/40 rounded-r-lg px-3 py-2`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-semibold uppercase ${
                    a.severity === 'critical' ? 'status-critical' : 'text-warning'
                  }`}
                >
                  {a.severity}
                </span>
                <span className="text-[10px] text-muted-foreground">{fmt(a.at)}</span>
              </div>
              <p className="text-xs text-foreground mt-0.5">{a.reason}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Level {a.waterLevel.toFixed(1)}% · TDS {Math.round(a.tdsValue)} ppm
              </p>
            </div>
          ))}
          {anomalies.length > 8 && (
            <p className="text-[10px] text-muted-foreground text-center">
              +{anomalies.length - 8} more
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AnomalyDetectionCard;
