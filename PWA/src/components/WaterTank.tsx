import { getWaterLevelColor } from '@/lib/water-utils';

interface WaterTankProps {
  level: number;
  upperThreshold?: number;
  lowerThreshold?: number;
  criticalThreshold?: number;
}

const WaterTank = ({ level, upperThreshold = 90, lowerThreshold = 35, criticalThreshold = 25 }: WaterTankProps) => {
  const color = getWaterLevelColor(level);
  const waterColor = color === 'safe' ? 'hsl(var(--safe))' : color === 'warning' ? 'hsl(var(--warning))' : 'hsl(var(--critical))';
  const waterColorLight = color === 'safe' ? 'hsl(145, 65%, 52%)' : color === 'warning' ? 'hsl(38, 92%, 65%)' : 'hsl(0, 72%, 65%)';

  const clampedLevel = Math.max(0, Math.min(100, level));

  return (
    <div className="flex flex-col items-center animate-scale-in">
      <div className="relative w-48 h-64 mx-auto">
        {/* Tank body */}
        <div className="absolute inset-0 rounded-2xl border-4 border-border bg-muted/30 overflow-hidden">
          {/* Threshold markers */}
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-safe/50 z-10"
            style={{ bottom: `${upperThreshold}%` }}
          >
            <span className="absolute -top-4 right-1 text-[10px] font-medium text-safe">{upperThreshold}%</span>
          </div>
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-warning/50 z-10"
            style={{ bottom: `${lowerThreshold}%` }}
          >
            <span className="absolute -top-4 right-1 text-[10px] font-medium text-warning">{lowerThreshold}%</span>
          </div>
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-critical/50 z-10"
            style={{ bottom: `${criticalThreshold}%` }}
          >
            <span className="absolute -top-4 right-1 text-[10px] font-medium text-critical">{criticalThreshold}%</span>
          </div>

          {/* Water fill */}
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
            style={{ height: `${clampedLevel}%` }}
          >
            {/* Wave SVG */}
            <div className="absolute -top-3 left-0 right-0 overflow-hidden h-4">
              <svg
                className="water-wave w-[200%] h-full"
                viewBox="0 0 800 20"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,10 C100,0 200,20 300,10 C400,0 500,20 600,10 C700,0 800,20 800,10 L800,20 L0,20 Z"
                  fill={waterColor}
                  opacity="0.8"
                />
              </svg>
            </div>
            <div className="absolute -top-2 left-0 right-0 overflow-hidden h-4">
              <svg
                className="water-wave-2 w-[200%] h-full"
                viewBox="0 0 800 20"
                preserveAspectRatio="none"
              >
                <path
                  d="M0,10 C100,20 200,0 300,10 C400,20 500,0 600,10 C700,20 800,0 800,10 L800,20 L0,20 Z"
                  fill={waterColorLight}
                  opacity="0.4"
                />
              </svg>
            </div>
            <div
              className="w-full h-full"
              style={{ backgroundColor: waterColor, opacity: 0.7 }}
            />
          </div>

          {/* Percentage label */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <span className="text-3xl font-bold text-foreground drop-shadow-sm">
              {Math.round(clampedLevel)}%
            </span>
          </div>
        </div>

        {/* Tank cap */}
        <div className="absolute -top-2 left-4 right-4 h-4 bg-border rounded-t-lg" />
        {/* Tank base */}
        <div className="absolute -bottom-2 left-2 right-2 h-3 bg-border rounded-b-lg" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">Water Tank Level</p>
    </div>
  );
};

export default WaterTank;
