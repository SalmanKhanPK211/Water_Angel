import { classifyPumpHealth, type PumpHealthResult } from '@/lib/data-science';
import type { SensorData } from '@/lib/water-utils';
import { Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  data: SensorData[];
}

const PumpHealthClassifier = ({ data }: Props) => {
  const health = classifyPumpHealth(data);

  const statusConfig = {
    healthy: { icon: CheckCircle, color: 'text-safe', bg: 'bg-safe/10', border: 'border-safe/20', label: 'Healthy' },
    degrading: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', label: 'Degrading' },
    critical: { icon: XCircle, color: 'text-critical', bg: 'bg-critical/10', border: 'border-critical/20', label: 'Critical' },
  };

  const config = statusConfig[health.status];
  const StatusIcon = config.icon;

  const factorIcon = {
    good: <CheckCircle className="h-3 w-3 text-safe" />,
    warning: <AlertTriangle className="h-3 w-3 text-warning" />,
    bad: <XCircle className="h-3 w-3 text-critical" />,
  };

  return (
    <div className="water-card space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" /> Pump Health Classification
      </h3>

      {/* Health Score */}
      <div className={`${config.bg} border ${config.border} rounded-xl p-4 flex items-center gap-4`}>
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={health.status === 'healthy' ? 'hsl(var(--safe))' : health.status === 'degrading' ? 'hsl(var(--warning))' : 'hsl(var(--critical))'}
              strokeWidth="8"
              strokeDasharray={`${health.score * 2.51} 251`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-base font-bold ${config.color}`}>
            {health.score}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-4 w-4 ${config.color}`} />
            <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{health.recommendation}</p>
        </div>
      </div>

      {/* Classification Factors */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Classification Factors</p>
        {health.factors.map((factor, i) => (
          <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              {factorIcon[factor.status]}
              <span className="text-xs text-foreground">{factor.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{factor.value}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Multi-factor classification • Duty cycle, variance, trend & cycling analysis
      </p>
    </div>
  );
};

export default PumpHealthClassifier;
