import { predictiveForecasting, type ForecastResult } from '@/lib/data-science';
import type { SensorData } from '@/lib/water-utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Brain, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  data: SensorData[];
}

const PredictiveForecast = ({ data }: Props) => {
  const forecast = predictiveForecasting(data, 24);

  if (forecast.predictedLevels.length === 0) {
    return (
      <div className="water-card">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> Predictive Forecasting
        </h3>
        <p className="text-xs text-muted-foreground mt-2">Insufficient data for predictions. Need at least 5 readings.</p>
      </div>
    );
  }

  const TrendIcon = forecast.trendDirection === 'falling' ? TrendingDown :
    forecast.trendDirection === 'rising' ? TrendingUp : Minus;

  const trendColor = forecast.trendDirection === 'falling' ? 'text-critical' :
    forecast.trendDirection === 'rising' ? 'text-safe' : 'text-muted-foreground';

  // Sample every 2 hours for chart readability
  const chartData = forecast.predictedLevels.filter((_, i) => i % 2 === 0);

  return (
    <div className="water-card space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" /> ML Predictive Forecasting
      </h3>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Trend</p>
          <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold capitalize">{forecast.trendDirection}</span>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Rate</p>
          <p className="text-xs font-semibold text-foreground">{forecast.ratePerHour}%/hr</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Confidence</p>
          <p className={`text-xs font-semibold ${
            forecast.confidence === 'high' ? 'text-safe' :
            forecast.confidence === 'medium' ? 'text-warning' : 'text-critical'
          }`}>{forecast.confidence.toUpperCase()}</p>
        </div>
      </div>

      {forecast.hoursUntilEmpty !== null && (
        <div className="bg-critical/10 border border-critical/20 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Estimated Time to Empty</p>
          <p className="text-lg font-bold text-critical">
            {forecast.hoursUntilEmpty < 24
              ? `${forecast.hoursUntilEmpty} hours`
              : `${Math.round(forecast.hoursUntilEmpty / 24)} days`}
          </p>
        </div>
      )}

      {forecast.hoursUntilFull !== null && (
        <div className="bg-safe/10 border border-safe/20 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Estimated Time to Full</p>
          <p className="text-lg font-bold text-safe">
            {forecast.hoursUntilFull < 24
              ? `${forecast.hoursUntilFull} hours`
              : `${Math.round(forecast.hoursUntilFull / 24)} days`}
          </p>
        </div>
      )}

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 11,
            }} />
            <ReferenceLine y={20} stroke="hsl(var(--critical))" strokeDasharray="5 5" label={{ value: 'Critical', fontSize: 9, fill: 'hsl(var(--critical))' }} />
            <Line type="monotone" dataKey="level" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicted Level %" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Weighted linear regression model • Based on {data.length} data points
      </p>
    </div>
  );
};

export default PredictiveForecast;
