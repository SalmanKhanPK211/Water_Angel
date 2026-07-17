import { correlationAnalysis, type CorrelationResult } from '@/lib/data-science';
import type { SensorData } from '@/lib/water-utils';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, LineChart } from 'recharts';
import { GitCompareArrows } from 'lucide-react';

interface Props {
  data: SensorData[];
}

const CorrelationAnalysis = ({ data }: Props) => {
  const tdsVsLevel = correlationAnalysis(data, 'water_level', 'tds_value');

  if (tdsVsLevel.scatterData.length < 3) {
    return (
      <div className="water-card">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-warning" /> Regression Analysis
        </h3>
        <p className="text-xs text-muted-foreground mt-2">Insufficient data for correlation analysis.</p>
      </div>
    );
  }

  const strengthColor = tdsVsLevel.strength === 'strong' ? 'text-safe' :
    tdsVsLevel.strength === 'moderate' ? 'text-warning' : 'text-muted-foreground';

  // Prepare regression line data (just 2 endpoints)
  const xVals = tdsVsLevel.scatterData.map(d => d.x);
  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);
  const regressionLine = [
    { x: minX, y: tdsVsLevel.regression.predict(minX) },
    { x: maxX, y: tdsVsLevel.regression.predict(maxX) },
  ];

  return (
    <div className="water-card space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-warning" /> Regression & Correlation
      </h3>
      <p className="text-[10px] text-muted-foreground">Water Level vs TDS (Total Dissolved Solids)</p>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Pearson r</p>
          <p className={`text-sm font-bold ${strengthColor}`}>
            {tdsVsLevel.coefficient.toFixed(3)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">R²</p>
          <p className="text-sm font-bold text-foreground">
            {tdsVsLevel.regression.rSquared.toFixed(3)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Strength</p>
          <p className={`text-xs font-semibold capitalize ${strengthColor}`}>
            {tdsVsLevel.strength} {tdsVsLevel.direction}
          </p>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="x" name="Water Level" unit="%" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis dataKey="y" name="TDS" unit="ppm" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: 11,
              }}
              formatter={(value: number, name: string) => [
                `${Math.round(value)}${name === 'Water Level' ? '%' : ' ppm'}`,
                name,
              ]}
            />
            <Scatter data={tdsVsLevel.scatterData} fill="hsl(var(--primary))" opacity={0.6} />
            <Scatter data={regressionLine} fill="none" line={{ stroke: 'hsl(var(--critical))', strokeWidth: 2, strokeDasharray: '5 5' }} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-muted/30 rounded-lg p-3">
        <p className="text-xs text-foreground">
          <span className="font-semibold">Regression Equation: </span>
          TDS = {tdsVsLevel.regression.slope.toFixed(2)} × Water Level + {tdsVsLevel.regression.intercept.toFixed(1)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {tdsVsLevel.direction === 'negative'
            ? 'As water level decreases, TDS tends to increase (concentrated solids in less water).'
            : tdsVsLevel.direction === 'positive'
            ? 'Water level and TDS move together — possibly due to source water quality.'
            : 'No significant linear relationship detected between water level and TDS.'}
        </p>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Pearson correlation + OLS linear regression • {data.length} observations
      </p>
    </div>
  );
};

export default CorrelationAnalysis;
