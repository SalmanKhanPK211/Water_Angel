import { Droplets, Gauge, Power, Clock, Activity } from 'lucide-react';
import { getWaterQualityStatus } from '@/lib/water-utils';
import type { SensorData } from '@/lib/water-utils';

interface MetricCardsProps {
  data: SensorData | null;
}

const MetricCards = ({ data }: MetricCardsProps) => {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="water-card animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-6 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const quality = getWaterQualityStatus(data.tds_value);
  const lastUpdate = new Date(data.created_at).toLocaleTimeString();

  const cards = [
    {
      icon: <Droplets className="h-5 w-5 text-primary" />,
      label: 'Water Level',
      value: `${Math.round(data.water_level)}%`,
      color: '',
    },
    {
      icon: <Gauge className="h-5 w-5 text-accent" />,
      label: 'TDS Value',
      value: `${Math.round(data.tds_value)} ppm`,
      sub: quality.label,
      color: quality.color,
    },
    {
      icon: <Power className="h-5 w-5" style={{ color: data.pump_status === 'ON' ? 'hsl(var(--safe))' : 'hsl(var(--muted-foreground))' }} />,
      label: 'Pump Status',
      value: data.pump_status,
      color: data.pump_status === 'ON' ? 'safe' : '',
    },
    {
      icon: <Clock className="h-5 w-5 text-muted-foreground" />,
      label: 'Last Update',
      value: lastUpdate,
      color: '',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card, i) => (
        <div key={i} className="water-card animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="flex items-center gap-2 mb-1">
            {card.icon}
            <span className="metric-label">{card.label}</span>
          </div>
          <p className={`metric-value ${card.color === 'safe' ? 'status-safe' : card.color === 'warning' ? 'status-warning' : card.color === 'critical' ? 'status-critical' : ''}`}>
            {card.value}
          </p>
          {card.sub && (
            <span className={`text-xs font-medium ${card.color === 'safe' ? 'status-safe' : card.color === 'warning' ? 'status-warning' : 'status-critical'}`}>
              {card.sub}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default MetricCards;
