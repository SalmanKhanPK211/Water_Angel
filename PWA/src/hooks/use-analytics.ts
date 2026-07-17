import { useMemo } from 'react';
import type { SensorData } from '@/lib/water-utils';

export function useAnalytics(weeklyData: SensorData[]) {
  return useMemo(() => {
    if (weeklyData.length === 0) {
      return {
        avgDailyUsage: 0,
        estimatedEmptyTime: 'N/A',
        peakUsageHour: 'N/A',
        waterEfficiencyScore: 0,
        avgTdsWeek: 0,
        avgTdsToday: 0,
        totalPumpRuns: 0,
        highestUsageDay: 'N/A',
        totalWaterUsed: 0,
        dailyConsumption: [] as { day: string; usage: number }[],
        tdsQualityTrend: 'stable' as string,
        recommendations: [] as string[],
      };
    }

    // Group by day
    const byDay: Record<string, SensorData[]> = {};
    weeklyData.forEach(d => {
      const day = new Date(d.created_at).toLocaleDateString('en-US', { weekday: 'short' });
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(d);
    });

    // Daily consumption (approximate from level drops)
    const dailyConsumption = Object.entries(byDay).map(([day, readings]) => {
      if (readings.length < 2) return { day, usage: 0 };
      let totalDrop = 0;
      for (let i = 1; i < readings.length; i++) {
        const diff = readings[i - 1].water_level - readings[i].water_level;
        if (diff > 0) totalDrop += diff;
      }
      return { day, usage: Math.round(totalDrop) };
    });

    const totalWaterUsed = dailyConsumption.reduce((s, d) => s + d.usage, 0);
    const avgDailyUsage = Math.round(totalWaterUsed / Math.max(Object.keys(byDay).length, 1));

    // Highest usage day
    const highestDay = dailyConsumption.reduce((max, d) => d.usage > max.usage ? d : max, { day: 'N/A', usage: 0 });

    // Estimate time until empty
    const latest = weeklyData[weeklyData.length - 1];
    const recentData = weeklyData.slice(-10);
    let dropRate = 0;
    if (recentData.length >= 2) {
      const timeDiffHours = (new Date(recentData[recentData.length - 1].created_at).getTime() - new Date(recentData[0].created_at).getTime()) / 3600000;
      const levelDiff = recentData[0].water_level - recentData[recentData.length - 1].water_level;
      if (timeDiffHours > 0 && levelDiff > 0) {
        dropRate = levelDiff / timeDiffHours;
      }
    }
    const estimatedEmptyTime = dropRate > 0
      ? `${Math.round(latest.water_level / dropRate)} hours`
      : 'N/A';

    // Peak usage hour
    const hourUsage: Record<number, number> = {};
    for (let i = 1; i < weeklyData.length; i++) {
      const diff = weeklyData[i - 1].water_level - weeklyData[i].water_level;
      if (diff > 0) {
        const hour = new Date(weeklyData[i].created_at).getHours();
        hourUsage[hour] = (hourUsage[hour] || 0) + diff;
      }
    }
    const peakHour = Object.entries(hourUsage).reduce((max, [h, v]) => v > max[1] ? [h, v] : max, ['0', 0]);
    const peakUsageHour = Object.keys(hourUsage).length > 0
      ? `${parseInt(peakHour[0])}:00 - ${parseInt(peakHour[0]) + 1}:00`
      : 'N/A';

    // TDS averages
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayData = weeklyData.filter(d => new Date(d.created_at) >= todayStart);
    const avgTdsWeek = Math.round(weeklyData.reduce((s, d) => s + d.tds_value, 0) / weeklyData.length);
    const avgTdsToday = todayData.length > 0
      ? Math.round(todayData.reduce((s, d) => s + d.tds_value, 0) / todayData.length)
      : avgTdsWeek;

    // TDS trend
    const firstHalf = weeklyData.slice(0, Math.floor(weeklyData.length / 2));
    const secondHalf = weeklyData.slice(Math.floor(weeklyData.length / 2));
    const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d.tds_value, 0) / firstHalf.length : 0;
    const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d.tds_value, 0) / secondHalf.length : 0;
    const tdsQualityTrend = avgSecond > avgFirst * 1.1 ? 'degrading' : avgSecond < avgFirst * 0.9 ? 'improving' : 'stable';

    // Pump runs
    const totalPumpRuns = weeklyData.filter(d => d.pump_status === 'ON').length;

    // Water efficiency score
    const levelVariance = weeklyData.reduce((s, d) => s + Math.abs(d.water_level - (weeklyData.reduce((a, b) => a + b.water_level, 0) / weeklyData.length)), 0) / weeklyData.length;
    const stabilityScore = Math.max(0, 100 - levelVariance * 2);
    const waterEfficiencyScore = Math.round(Math.min(100, stabilityScore));

    // Recommendations
    const recommendations: string[] = [];
    if (dropRate > 5) recommendations.push('Refill tank before evening peak usage.');
    if (avgTdsToday > avgTdsWeek * 1.15) recommendations.push(`Water consumption TDS increased by ${Math.round(((avgTdsToday - avgTdsWeek) / avgTdsWeek) * 100)}% compared to weekly average.`);
    if (peakUsageHour !== 'N/A') recommendations.push(`Highest water usage occurs between ${peakUsageHour}.`);
    if (latest && latest.water_level < 40) recommendations.push('Tank level is low. Consider refilling soon.');

    return {
      avgDailyUsage,
      estimatedEmptyTime,
      peakUsageHour,
      waterEfficiencyScore,
      avgTdsWeek,
      avgTdsToday,
      totalPumpRuns,
      highestUsageDay: highestDay.day,
      totalWaterUsed,
      dailyConsumption,
      tdsQualityTrend,
      recommendations,
    };
  }, [weeklyData]);
}
