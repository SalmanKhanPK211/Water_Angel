import { useAlerts } from '@/hooks/use-water-data';
import { getSeverityIcon } from '@/lib/water-utils';
import { Bell } from 'lucide-react';

const AlertsPage = () => {
  const { alerts, loading } = useAlerts();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 py-4 sticky top-0 z-40">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Alerts
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="water-card animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="water-card text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No alerts yet</p>
            <p className="text-muted-foreground text-xs mt-1">Alerts will appear here when triggered</p>
          </div>
        ) : (
          alerts.map((alert, i) => (
            <div
              key={alert.id}
              className={`water-card border-l-4 animate-fade-in ${
                alert.severity === 'critical'
                  ? 'border-l-critical'
                  : alert.severity === 'warning'
                  ? 'border-l-warning'
                  : 'border-l-primary'
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{getSeverityIcon(alert.severity)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{alert.alert_message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground capitalize">{alert.alert_type}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsPage;
