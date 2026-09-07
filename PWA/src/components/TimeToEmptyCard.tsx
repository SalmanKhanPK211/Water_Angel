import { Hourglass, Droplets, AlertCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTimeToEmpty } from '@/hooks/use-time-to-empty';
import { useDevice } from '@/hooks/useDevice';
import { litersFromPercent, formatLiters } from '@/lib/water-utils';

const TimeToEmptyCard = () => {
  const tte = useTimeToEmpty();
  const { device } = useDevice();
  const capacity = device?.capacity_liters ?? null;
  const remaining = capacity ? litersFromPercent(tte.currentLevel, capacity) : null;

  const emptyAtLabel = tte.emptyAt
    ? tte.emptyAt.toLocaleString([], {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const explainer =
    tte.state === 'ok'
      ? `Tank should hit 0% around ${emptyAtLabel} at the current usage rate.`
      : tte.state === 'idle'
        ? 'Water level is steady — no measurable usage in the last 6 hours, so no empty time can be estimated.'
        : `Need a few more readings while the pump is off (${tte.usableDeltas}/3 usable so far).`;

  return (
    <div className="water-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-primary" /> Time to Empty
        </h3>
        <span className="text-[10px] text-muted-foreground">Live · last 6 h</span>
      </div>

      <p
        className={`text-2xl font-bold ${
          tte.state === 'ok' ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {tte.label}
      </p>

      <div className="bg-muted/50 rounded-lg p-2 text-center">
        <p className="text-[10px] text-muted-foreground">Empty at</p>
        <p className="text-xs font-semibold text-foreground">{emptyAtLabel}</p>
      </div>


      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        {explainer}
      </p>

      {remaining !== null ? (
        <p className="text-xs text-foreground flex items-center gap-2">
          <Droplets className="h-3.5 w-3.5 text-primary" />
          About <span className="font-semibold">{formatLiters(remaining)}</span> left of{' '}
          {formatLiters(capacity!)}
        </p>
      ) : (
        <Link
          to="/profile"
          className="text-xs text-muted-foreground flex items-center gap-2 hover:text-foreground"
        >
          <AlertCircle className="h-3.5 w-3.5 text-warning" />
          Set your tank capacity to see litres instead of percent
        </Link>
      )}
    </div>
  );
};

export default TimeToEmptyCard;
