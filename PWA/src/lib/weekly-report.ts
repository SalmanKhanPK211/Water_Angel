import type { SensorData } from '@/lib/water-utils';
import type { DailyUsage } from '@/hooks/use-daily-usage';

export interface WeeklyReportInput {
  deviceName: string;
  deviceId: string;
  capacityLiters: number | null;
  weekly: SensorData[];
  dailyUsage: DailyUsage[];
  forecast: { date: string | null; liters: number | null; percent: number }[];
  forecastUnit: 'liters' | 'percent';
}

const fmtDate = (d: Date) => d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

/** Sum of positive pump_runtime increments across the week (minutes). */
export function sumPumpRuntime(readings: SensorData[]): number {
  const ordered = [...readings].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let total = 0;
  for (let i = 1; i < ordered.length; i++) {
    const diff = (ordered[i].pump_runtime || 0) - (ordered[i - 1].pump_runtime || 0);
    if (diff > 0) total += diff;
    else if ((ordered[i].pump_runtime || 0) > 0 && diff < 0) total += ordered[i].pump_runtime || 0;
  }
  return Math.round(total);
}

export function buildWeeklyReportHtml(input: WeeklyReportInput): string {
  const { deviceName, deviceId, capacityLiters, weekly, dailyUsage, forecast, forecastUnit } = input;

  const now = new Date();
  const start = new Date(now.getTime() - 6 * 86400000);

  const totalLiters = dailyUsage.reduce((s, d) => s + d.liters_used, 0);
  const days = Math.max(dailyUsage.length, 1);
  const avgLiters = totalLiters / days;
  const peakDay = dailyUsage.reduce<DailyUsage | null>(
    (max, d) => (!max || d.liters_used > max.liters_used ? d : max),
    null
  );

  const tdsVals = weekly.map(d => d.tds_value).filter(v => Number.isFinite(v));
  const avgTds = tdsVals.length ? Math.round(tdsVals.reduce((s, v) => s + v, 0) / tdsVals.length) : null;
  const minTds = tdsVals.length ? Math.round(Math.min(...tdsVals)) : null;
  const maxTds = tdsVals.length ? Math.round(Math.max(...tdsVals)) : null;

  const pumpMinutes = sumPumpRuntime(weekly);
  const pumpActivations = weekly.filter(
    (d, i) => d.pump_status === 'ON' && (i === 0 || weekly[i - 1].pump_status !== 'ON')
  ).length;

  const levels = weekly.map(d => d.water_level);
  const avgLevel = levels.length ? Math.round(levels.reduce((s, v) => s + v, 0) / levels.length) : null;
  const minLevel = levels.length ? Math.round(Math.min(...levels)) : null;

  const forecastTotal = forecast.reduce(
    (s, f) => s + (forecastUnit === 'liters' ? (f.liters ?? 0) : f.percent),
    0
  );
  const forecastAvg = forecast.length ? forecastTotal / forecast.length : 0;
  const unitLabel = forecastUnit === 'liters' ? 'L' : '% of tank';

  const usageRows = dailyUsage
    .map(
      d => `<tr><td>${new Date(`${d.usage_date}T00:00:00`).toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })}</td><td>${Math.round(d.liters_used).toLocaleString()} L</td><td>${d.percent_used.toFixed(
        1
      )}%</td><td>${d.readings_count}</td></tr>`
    )
    .join('');

  const forecastRows = forecast
    .map(f => {
      const val = forecastUnit === 'liters' ? f.liters : f.percent;
      return `<tr><td>${
        f.date
          ? new Date(`${f.date}T00:00:00`).toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          : '—'
      }</td><td>${val != null ? `${Math.round(val).toLocaleString()} ${unitLabel}` : '—'}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Water Angel — Weekly Report (${fmtDate(now)})</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;color:#12283a;margin:32px;background:#fff}
 h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:26px 0 8px;color:#0f6fa8}
 .sub{color:#5b7185;font-size:12px;margin-bottom:18px}
 table{border-collapse:collapse;width:100%;font-size:12px}
 th,td{border:1px solid #d8e3ec;padding:6px 8px;text-align:left}
 th{background:#eef6fb}
 .cards{display:flex;flex-wrap:wrap;gap:10px}
 .card{border:1px solid #d8e3ec;border-radius:8px;padding:10px 14px;min-width:150px}
 .card .k{font-size:11px;color:#5b7185} .card .v{font-size:17px;font-weight:bold}
 footer{margin-top:28px;font-size:11px;color:#7b8fa1}
 @media print{body{margin:12mm}}
</style></head><body>
<h1>Water Angel — Weekly Water Report</h1>
<div class="sub">${deviceName} · Device ID ${deviceId}<br/>
Period: ${fmtDate(start)} – ${fmtDate(now)} · Generated ${now.toLocaleString()}<br/>
Tank capacity: ${capacityLiters ? `${capacityLiters.toLocaleString()} L` : 'not set'}</div>

<h2>This week at a glance</h2>
<div class="cards">
 <div class="card"><div class="k">Total consumption</div><div class="v">${Math.round(totalLiters).toLocaleString()} L</div></div>
 <div class="card"><div class="k">Daily average</div><div class="v">${Math.round(avgLiters).toLocaleString()} L</div></div>
 <div class="card"><div class="k">Highest usage day</div><div class="v">${
   peakDay
     ? `${new Date(`${peakDay.usage_date}T00:00:00`).toLocaleDateString([], { weekday: 'short' })} · ${Math.round(peakDay.liters_used).toLocaleString()} L`
     : '—'
 }</div></div>
 <div class="card"><div class="k">Average TDS</div><div class="v">${avgTds != null ? `${avgTds} ppm` : '—'}</div></div>
 <div class="card"><div class="k">TDS range</div><div class="v">${minTds != null ? `${minTds}–${maxTds} ppm` : '—'}</div></div>
 <div class="card"><div class="k">Total pump run time</div><div class="v">${pumpMinutes} min</div></div>
 <div class="card"><div class="k">Pump activations</div><div class="v">${pumpActivations}</div></div>
 <div class="card"><div class="k">Average tank level</div><div class="v">${avgLevel != null ? `${avgLevel}%` : '—'}</div></div>
 <div class="card"><div class="k">Lowest tank level</div><div class="v">${minLevel != null ? `${minLevel}%` : '—'}</div></div>
 <div class="card"><div class="k">Sensor readings</div><div class="v">${weekly.length}</div></div>
</div>

<h2>Daily consumption</h2>
<table><thead><tr><th>Day</th><th>Used</th><th>% of tank</th><th>Readings</th></tr></thead>
<tbody>${usageRows || '<tr><td colspan="4">No rolled-up usage for this period.</td></tr>'}</tbody></table>

<h2>Coming week forecast (XGBoost model)</h2>
${
  forecast.length
    ? `<div class="cards">
 <div class="card"><div class="k">Forecast total</div><div class="v">${Math.round(forecastTotal).toLocaleString()} ${unitLabel}</div></div>
 <div class="card"><div class="k">Forecast daily average</div><div class="v">${Math.round(forecastAvg).toLocaleString()} ${unitLabel}</div></div>
</div>
<table style="margin-top:10px"><thead><tr><th>Day</th><th>Predicted consumption</th></tr></thead><tbody>${forecastRows}</tbody></table>`
    : '<p style="font-size:12px">No forecast available yet.</p>'
}

<footer>Generated by Water Angel. Consumption is derived from tank level drops (refills excluded) and your configured tank capacity.</footer>
</body></html>`;
}

export function downloadWeeklyReport(input: WeeklyReportInput) {
  const html = buildWeeklyReportHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `water-angel-weekly-report-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
