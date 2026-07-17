import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { SensorData } from '@/lib/water-utils';

interface MiniChartProps {
  data: SensorData[];
}

const MiniChart = ({ data }: MiniChartProps) => {
  const chartData = data.map(d => ({
    time: new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    level: Math.round(d.water_level),
  }));

  if (chartData.length === 0) {
    return (
      <div className="water-card h-40 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No data for the last 24 hours</p>
      </div>
    );
  }

  return (
    <div className="water-card">
      <h3 className="text-sm font-semibold text-foreground mb-3">Water Level — Last 24h</h3>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="level"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MiniChart;
