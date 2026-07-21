export interface SensorData {
  id: string;
  water_level: number;
  tds_value: number;
  pump_status: string;
  pump_mode: string;
  pump_runtime: number;
  device_id: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  alert_message: string;
  severity: string;
  device_id: string | null;
  created_at: string;
}

export interface PumpSettings {
  id: string;
  pump_mode: string;
  pump_status: string;
  upper_threshold: number;
  lower_threshold: number;
  critical_threshold: number;
  device_id: string | null;
  updated_at: string;
}

export function getWaterLevelColor(level: number): string {
  if (level <= 20) return 'critical';
  if (level <= 60) return 'warning';
  return 'safe';
}

export function getWaterQualityStatus(tds: number): { label: string; color: string } {
  if (tds < 300) return { label: 'Safe', color: 'safe' };
  if (tds <= 600) return { label: 'Moderate', color: 'warning' };
  return { label: 'Unsafe', color: 'critical' };
}

export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'warning': return '🟡';
    default: return '🔵';
  }
}
