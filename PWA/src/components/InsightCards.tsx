import { Lightbulb, TrendingDown, Clock } from 'lucide-react';

interface InsightCardsProps {
  avgDailyUsage: number;
  estimatedEmptyTime: string;
  peakUsageHour: string;
  recommendations: string[];
}

const InsightCards = ({ avgDailyUsage, estimatedEmptyTime, peakUsageHour, recommendations }: InsightCardsProps) => {
  const insights = [
    {
      icon: <TrendingDown className="h-5 w-5 text-primary" />,
      title: 'Avg Daily Usage',
      value: `${avgDailyUsage}% level drop`,
    },
    {
      icon: <Clock className="h-5 w-5 text-warning" />,
      title: 'Est. Time to Empty',
      value: estimatedEmptyTime,
    },
    {
      icon: <Lightbulb className="h-5 w-5 text-accent" />,
      title: 'Peak Usage',
      value: peakUsageHour,
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Smart Insights</h3>
      <div className="grid gap-3">
        {insights.map((item, i) => (
          <div key={i} className="water-card flex items-center gap-3 animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="p-2 rounded-lg bg-muted">{item.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{item.title}</p>
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
      {recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((rec, i) => (
            <div key={i} className="water-card border-l-4 border-l-primary py-3">
              <p className="text-xs text-foreground">{rec}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InsightCards;
