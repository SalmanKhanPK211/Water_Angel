import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Brain, CalendarRange, Clock } from 'lucide-react';
import { useDevice } from '@/hooks/useDevice';
import { litersFromPercent, formatLiters } from '@/lib/water-utils';
import { useMlPredictions } from '@/hooks/use-ml-predictions';

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

const fmtAbsolute = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fmtRelative = (iso: string | null) => {
  if (!iso) return '';
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

const confidenceLabel = (c: number | null) => {
  if (c === null || c === undefined) return { text: '—', cls: 'text-muted-foreground' };
  if (c >= 0.7) return { text: `${Math.round(c * 100)}% high`, cls: 'status-safe' };
  if (c >= 0.4) return { text: `${Math.round(c * 100)}% medium`, cls: 'text-warning' };
  return { text: `${Math.round(c * 100)}% low`, cls: 'status-critical' };
};

const MlPredictionPanel = () => {
  const { dailyConsumption, lastRun, loading } = useMlPredictions();
  const { device } = useDevice();
  const capacity = device?.capacity_liters ?? null;

  if (loading) {
    return (
      <div className="water-card">
        <p className="text-xs text-muted-foreground">Loading consumption forecast…</p>
      </div>
    );
  }

  if (dailyConsumption.length === 0) {
    return (
      <div className="water-card space-y-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> Water Consumption Prediction
        </h3>
        <p className="text-xs text-muted-foreground">
          No forecast yet. The Python consumption model publishes results here after its next scheduled run.
        </p>
      </div>
    );
  }

  const inLiters = dailyConsumption[0]?.metadata?.unit === 'liters_per_day';
  const consumptionChart = dailyConsumption.map(p => ({
    day: (p.metadata?.day_name as string) ||
      (p.target_date ? new Date(p.target_date).toLocaleDateString([], { weekday: 'short' }) : '—'),
    date: p.target_date,
    predicted: Number(p.predicted_value) || 0,
    liters: inLiters
      ? Math.round(Number(p.predicted_value) || 0)
      : capacity ? Math.round(litersFromPercent(Number(p.predicted_value) || 0, capacity)) : null,
  }));

  const weeklyTotal = consumptionChart.reduce((s, d) => s + d.predicted, 0);
  const conf = confidenceLabel(dailyConsumption[0]?.confidence ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> Water Consumption Prediction
        </h3>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Updated {fmtRelative(lastRun)}
        </span>
      </div>

      <div className="water-card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-accent" /> Predicted Daily Consumption (next 7 days)
          </h4>
          <span className={`text-[10px] font-semibold ${conf.cls}`}>{conf.text}</span>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={consumptionChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={chartTooltipStyle}
                formatter={(v: number, _n, item: any) =>
                  [item?.payload?.liters != null ? `${item.payload.liters} L` : `${v}% of tank`, 'Predicted']
                }
              />
              <Bar dataKey="predicted" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Forecast total</p>
            <p className="text-xs font-semibold text-foreground">
              {inLiters
                ? formatLiters(weeklyTotal)
                : capacity ? formatLiters(litersFromPercent(weeklyTotal, capacity)) : `${weeklyTotal.toFixed(1)}% of tank`}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Daily average</p>
            <p className="text-xs font-semibold text-foreground">
              {inLiters
                ? formatLiters(weeklyTotal / consumptionChart.length)
                : capacity
                  ? formatLiters(litersFromPercent(weeklyTotal / consumptionChart.length, capacity))
                  : `${(weeklyTotal / consumptionChart.length).toFixed(1)}%`}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Run {fmtAbsolute(dailyConsumption[0]?.created_at ?? null)}
        </p>
      </div>
    </div>
  );
};

export default MlPredictionPanel;
