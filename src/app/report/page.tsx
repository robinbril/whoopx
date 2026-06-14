import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { TrendChart } from "@/components/viz/TrendChart";
import { getWhoopClient } from "@/lib/whoop/client";
import type { TrendOutT } from "@/lib/whoop/schemas/trend";
import { WeekHeader } from "./_components/WeekHeader";
import { HeadlineAverages } from "./_components/HeadlineAverages";
import { CompareRow, CompareSectionHeader } from "./_components/CompareRow";
import { WeekSummaryLine } from "./_components/WeekSummaryLine";

// Pull the "week" segment from a trend, fallback to first segment.
function weekSeg(trend: TrendOutT) {
  return trend.segments.find((s) => s.label === "week") ?? trend.segments[0] ?? null;
}

// Map week segment points to TrendChart format, dropping null values.
function toChartPoints(trend: TrendOutT): { label: string; value: number }[] {
  const seg = weekSeg(trend);
  if (!seg) return [];
  return seg.points
    .filter((p): p is typeof p & { value: number } => p.value !== null)
    .map((p) => ({
      label: new Date(p.date + "T00:00:00Z").toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
      value: p.value,
    }));
}

export default async function ReportPage() {
  const client = await getWhoopClient();

  const [recoveryTrend, strainTrend, sleepTrend, compare] = await Promise.all([
    client.getTrend("RECOVERY"),
    client.getTrend("DAY_STRAIN"),
    client.getTrend("SLEEP_PERFORMANCE"),
    client.getCompare({ window: "week" }),
  ]);

  const recSeg = weekSeg(recoveryTrend);
  const strSeg = weekSeg(strainTrend);
  const slpSeg = weekSeg(sleepTrend);

  const avgRecovery = recSeg?.avg ?? 0;
  const avgStrain = strSeg?.avg ?? 0;
  const avgSleep = slpSeg?.avg ?? 0;

  const weekStart = recSeg?.start_date ?? compare.a.start_date;
  const weekEnd = recSeg?.end_date ?? compare.a.end_date;

  const recoveryPoints = toChartPoints(recoveryTrend);

  // Only show compare rows for these metrics, in display order.
  const compareOrder = ["RECOVERY", "SLEEP_PERFORMANCE", "HRV", "RHR", "DAY_STRAIN"];
  const compareRows = compareOrder
    .map((m) => compare.metrics.find((r) => r.metric === m))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  return (
    <>
      <TopBar title="Weekly Report" back />
      <div className="px-4 pb-14 pt-5 space-y-4">
        <WeekHeader startDate={weekStart} endDate={weekEnd} />

        {/* Three headline rings */}
        <Card>
          <CardLabel>Avg this week</CardLabel>
          <div className="mt-3">
            <HeadlineAverages
              avgRecovery={avgRecovery}
              avgStrain={avgStrain}
              avgSleep={avgSleep}
            />
          </div>
        </Card>

        {/* Recovery trend chart */}
        <Card>
          <CardLabel>Recovery · last 7 days</CardLabel>
          <div className="mt-4">
            {recoveryPoints.length > 0 ? (
              <TrendChart
                data={recoveryPoints}
                color="var(--color-recovery-green)"
                unit="%"
                height={160}
                domain={[0, 100]}
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-dim">
                No data available.
              </div>
            )}
          </div>
          {recSeg && (
            <div className="mt-3 flex gap-5">
              {recSeg.min !== null && (
                <div>
                  <CardLabel>Low</CardLabel>
                  <p className="tabular mt-0.5 text-[14px] font-semibold text-fg">
                    {Math.round(recSeg.min)}%
                  </p>
                </div>
              )}
              {recSeg.max !== null && (
                <div>
                  <CardLabel>High</CardLabel>
                  <p className="tabular mt-0.5 text-[14px] font-semibold text-fg">
                    {Math.round(recSeg.max)}%
                  </p>
                </div>
              )}
              {recSeg.avg !== null && (
                <div>
                  <CardLabel>Avg</CardLabel>
                  <p className="tabular mt-0.5 text-[14px] font-semibold text-recovery-green">
                    {Math.round(recSeg.avg)}%
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* vs last week compare */}
        <Card>
          <CardLabel>vs last week</CardLabel>
          <div className="mt-3">
            <CompareSectionHeader />
            {compareRows.map((row) => (
              <CompareRow key={row.metric} row={row} />
            ))}
          </div>
        </Card>

        {/* Plain-English summary */}
        <Card>
          <CardLabel>Summary</CardLabel>
          <div className="mt-2">
            <WeekSummaryLine compare={compare} />
          </div>
        </Card>
      </div>
    </>
  );
}
