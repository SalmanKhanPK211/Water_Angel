import { clusterUsagePatterns, type UsageCluster } from '@/lib/data-science';
import type { SensorData } from '@/lib/water-utils';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ZAxis } from 'recharts';
import { Network } from 'lucide-react';

interface Props {
  data: SensorData[];
}

const UsageClustering = ({ data }: Props) => {
  const clusters = clusterUsagePatterns(data, 3);

  if (clusters.length === 0 || clusters[0].points.length === 0) {
    return (
      <div className="water-card">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Network className="h-4 w-4 text-accent" /> Usage Pattern Clustering
        </h3>
        <p className="text-xs text-muted-foreground mt-2">Insufficient usage data for clustering analysis.</p>
      </div>
    );
  }

  const colorMap: Record<number, string> = {
    0: 'hsl(var(--primary))',
    1: 'hsl(var(--warning))',
    2: 'hsl(var(--safe))',
  };

  return (
    <div className="water-card space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Network className="h-4 w-4 text-accent" /> K-Means Usage Clustering
      </h3>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="hour" name="Hour" unit="h" domain={[0, 24]} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis dataKey="usage" name="Usage" unit="%" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <ZAxis range={[30, 60]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: 11,
              }}
              formatter={(value: number, name: string) => [
                `${value}${name === 'Hour' ? 'h' : '%'}`,
                name,
              ]}
            />
            {clusters.map((cluster, i) => (
              <Scatter
                key={cluster.id}
                name={cluster.label}
                data={cluster.points}
                fill={colorMap[i] || 'hsl(var(--muted-foreground))'}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {clusters.map((cluster, i) => (
          <div key={cluster.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[i] || '#888' }} />
              <span className="text-xs font-medium text-foreground">{cluster.label}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground">
                ~{cluster.centroidHour}:00 • {cluster.centroidUsage}% avg • {cluster.points.length} events
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        K-Means clustering (k=3) • Segments daily water usage by time and volume
      </p>
    </div>
  );
};

export default UsageClustering;
