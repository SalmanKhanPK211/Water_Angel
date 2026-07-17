import { Droplets } from 'lucide-react';
import WaterTank from '@/components/WaterTank';
import MetricCards from '@/components/MetricCards';
import MiniChart from '@/components/MiniChart';
import InsightCards from '@/components/InsightCards';
import ApiStatus from '@/components/ApiStatus';
import { useLatestSensorData, useSensorHistory, useWeeklySensorData, usePumpSettings } from '@/hooks/use-water-data';
import { useAnalytics } from '@/hooks/use-analytics';

const Index = () => {
  const { data: latest, loading } = useLatestSensorData();
  const { data: history24h } = useSensorHistory(24);
  const { data: weeklyData } = useWeeklySensorData();
  const { settings } = usePumpSettings();
  const analytics = useAnalytics(weeklyData);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-40">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Droplets className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Water Angel</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* API Status */}
        <ApiStatus lastUpdate={latest?.created_at ?? null} />
        <div className="water-card flex justify-center py-6">
          <WaterTank
            level={latest?.water_level ?? 0}
            upperThreshold={settings?.upper_threshold ?? 90}
            lowerThreshold={settings?.lower_threshold ?? 35}
            criticalThreshold={settings?.critical_threshold ?? 25}
          />
        </div>

        {/* Metric Cards */}
        <MetricCards data={latest} />

        {/* Mini Chart */}
        <MiniChart data={history24h} />

        {/* Insight Cards */}
        <InsightCards
          avgDailyUsage={analytics.avgDailyUsage}
          estimatedEmptyTime={analytics.estimatedEmptyTime}
          peakUsageHour={analytics.peakUsageHour}
          recommendations={analytics.recommendations}
        />
      </div>
    </div>
  );
};

export default Index;
