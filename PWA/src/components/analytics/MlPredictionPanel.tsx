import { Brain } from 'lucide-react';
import { useMlPredictions } from '@/hooks/use-ml-predictions';

const parseDay = (s?: string | null) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`) : null);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtFull = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const MODEL_NAMES: Record<string, string> = { 'prophet-v1': 'Prophet', 'xgb-v1': 'XGBoost' };

const MlPredictionPanel = () => {
  const { weeklyForecast: f, loading } = useMlPredictions();

  const title = (
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <Brain className="h-4 w-4 text-primary" /> Coming Week Predicted Consumption
    </h3>
  );

  if (loading) {
    return <div className="water-card">{title}<p className="text-xs text-muted-foreground mt-2">Loading…</p></div>;
  }

  if (!f) {
    return (
      <div className="water-card space-y-1">
        {title}
        <p className="text-xs text-muted-foreground">No weekly forecast yet. It appears here after the model's next run.</p>
      </div>
    );
  }

  const start = parseDay(f.metadata?.week_start ?? f.target_date);
  const end = parseDay(f.metadata?.week_end) ?? (start ? addDays(start, 6) : null);
  const range = start && end ? `${fmtShort(start)} – ${fmtFull(end)}` : '—';
  const liters = Math.round(Number(f.predicted_value) || 0);
  const model = MODEL_NAMES[f.model_version] ?? f.model_version;

  return (
    <div className="water-card space-y-2">
      {title}
      <p className="text-xs text-muted-foreground">{range}</p>
      <p className="text-3xl font-bold text-foreground">{liters.toLocaleString()} litres</p>
      <p className="text-[11px] text-muted-foreground">
        Model: {model} | Last Updated: {fmtFull(new Date(f.created_at))}
      </p>
    </div>
  );
};

export default MlPredictionPanel;
