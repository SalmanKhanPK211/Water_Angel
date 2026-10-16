import { useWeeklySensorData } from '@/hooks/use-water-data';
import { useAnalytics } from '@/hooks/use-analytics';
import { useDailyUsage } from '@/hooks/use-daily-usage';
import { useMlPredictions } from '@/hooks/use-ml-predictions';
import { useDevice } from '@/hooks/useDevice';
import { formatLiters, litersFromPercent } from '@/lib/water-utils';
import { downloadWeeklyReport } from '@/lib/weekly-report';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, Droplets, Gauge, Zap, Download } from 'lucide-react';
import MlPredictionPanel from '@/components/analytics/MlPredictionPanel';
import TimeToEmptyCard from '@/components/TimeToEmptyCard';


const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

const AnalyticsPage = () => {
  const { data: weeklyData, loading } = useWeeklySensorData();
  const analytics = useAnalytics(weeklyData);
  const { data: dailyUsage } = useDailyUsage(7);


  const waterLevelChart = weeklyData.map(d => ({
    time: new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    level: Math.round(d.water_level),
  }));

  const tdsChart = weeklyData.map(d => ({
    time: new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    tds: Math.round(d.tds_value),
  }));

  const pumpChart = weeklyData.filter(d => d.pump_status === 'ON').reduce((acc, d) => {
    const day = new Date(d.created_at).toLocaleDateString([], { weekday: 'short' });
    const existing = acc.find(a => a.day === day);
    if (existing) existing.runs++;
    else acc.push({ day, runs: 1 });
    return acc;
  }, [] as { day: string; runs: number }[]);

  // Daily consumption: prefer the nightly litre rollup, fall back to percent drops.
  const usageInLiters = dailyUsage.some(d => d.liters_used > 0);
  const consumptionChart = usageInLiters
    ? dailyUsage.map(d => ({
        day: new Date(`${d.usage_date}T00:00:00`).toLocaleDateString([], { weekday: 'short' }),
        usage: Math.round(d.liters_used),
      }))
    : analytics.dailyConsumption;
  const litersWeekTotal = dailyUsage.reduce((s, d) => s + d.liters_used, 0);

  const { weeklyForecast } = useMlPredictions();
  const forecastRows = weeklyForecast ? [weeklyForecast] : [];
  const { device } = useDevice();
  const capacity = device?.capacity_liters ?? null;
  const forecastInLiters = true;

  const handleDownload = () => {
    if (!device) {
      toast({ title: 'No device paired', description: 'Pair your device to download a report.' });
      return;
    }
    downloadWeeklyReport({
      deviceName: device.device_name || 'Water Angel',
      deviceId: device.id,
      capacityLiters: capacity,
      weekly: weeklyData,
      dailyUsage,
      forecast: forecastRows.map(p => {
        const value = Number(p.predicted_value) || 0;
        const isL = String(p.metadata?.unit ?? '').startsWith('liters');
        return {
          date: p.target_date,
          liters: isL ? value : capacity ? litersFromPercent(value, capacity) : null,
          percent: value,
        };
      }),
      forecastUnit: forecastInLiters ? 'liters' : 'percent',
    });
    toast({ title: 'Report downloaded', description: 'Open the file to view or print it.' });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-foreground">Analytics</h1>
          <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
            <Download className="h-4 w-4" /> Weekly report
          </Button>
        </div>
      </div>


      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Water consumption forecast (published by the Python model) */}
        <MlPredictionPanel />

        {/* Live time-to-empty (computed in the app from last 6 h) */}
        <TimeToEmptyCard />

        {/* Water Level History */}
        <div className="water-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" /> Water Level History
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={waterLevelChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="level" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Consumption */}
        <div className="water-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" /> Daily Consumption (7 days)
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">
              {usageInLiters ? 'litres' : '% of tank'}
            </span>
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumptionChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v: number) => [usageInLiters ? `${Math.round(v)} L` : `${v}% of tank`, 'Used']}
                />
                <Bar dataKey="usage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {usageInLiters && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Week total</p>
                <p className="text-xs font-semibold text-foreground">{formatLiters(litersWeekTotal)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Daily average</p>
                <p className="text-xs font-semibold text-foreground">
                  {formatLiters(litersWeekTotal / Math.max(consumptionChart.length, 1))}
                </p>
              </div>
            </div>
          )}
        </div>


        {/* TDS Trend */}
        <div className="water-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-warning" /> Water Quality (TDS) Trend
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tdsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="tds" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pump Activity */}
        <div className="water-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-safe" /> Pump Activity
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pumpChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="runs" fill="hsl(var(--safe))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recommendations */}
        {analytics.recommendations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">💡 Recommendations</h3>
            {analytics.recommendations.map((rec, i) => (
              <div key={i} className="water-card border-l-4 border-l-accent py-3">
                <p className="text-xs text-foreground">{rec}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default AnalyticsPage;
