import { Download, FileSpreadsheet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageNav } from "../components/PageNav";
import { ErrorBlock, LoadingBlock } from "../components/StateBlocks";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFiscalYear } from "../lib/fiscalYear";
import { cn, formatCurrency, formatHours } from "../lib/utils";
import type {
  LaborCostReport,
  LaborCostReportDimension,
  LaborCostReportMetric,
  LaborCostReportOptionalDimension,
  LaborCostReportRow,
  LaborCostReportSort,
} from "../types/api";

const DIMENSION_OPTIONS: Array<{ key: LaborCostReportDimension; label: string }> = [
  { key: "person", label: "Person" },
  { key: "role", label: "Role" },
  { key: "employment_type", label: "Employment Type" },
  { key: "team", label: "Team" },
  { key: "product", label: "Product" },
  { key: "bucket", label: "Bucket" },
];

const METRIC_OPTIONS: Array<{ key: LaborCostReportMetric; label: string }> = [
  { key: "forecast_cost", label: "Forecast Cost" },
  { key: "actual_cost", label: "Actual Cost" },
  { key: "variance_cost", label: "Variance Cost" },
  { key: "forecast_hours", label: "Forecast Hours" },
  { key: "actual_hours", label: "Actual Hours" },
];

export function ReportsPage() {
  const { fiscalYear, fiscalYearLabel, fiscalYearRangeLabel } = useFiscalYear();
  const { status } = useAuth();
  const canViewNamedPeople = status?.capabilities.can_view_named_people === true;
  const canViewTeamMemberProfiles = status?.capabilities.can_view_team_member_profiles === true;
  const [leadDimension, setLeadDimension] = useState<LaborCostReportDimension>("product");
  const [secondDimension, setSecondDimension] = useState<LaborCostReportOptionalDimension>("bucket");
  const [thirdDimension, setThirdDimension] = useState<LaborCostReportOptionalDimension>("role");
  const [fourthDimension, setFourthDimension] = useState<LaborCostReportOptionalDimension>("employment_type");
  const [sortMetric, setSortMetric] = useState<LaborCostReportSort>("forecast_cost");
  const [report, setReport] = useState<LaborCostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<"year" | "month" | "range">("year");
  const [selectedMonth, setSelectedMonth] = useState("1");
  const [rangeStart, setRangeStart] = useState(`${fiscalYear - 1}-07-01`);
  const [rangeEnd, setRangeEnd] = useState(`${fiscalYear}-06-30`);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const reportParams = useMemo(
    () => ({
      lead: leadDimension,
      second: secondDimension,
      third: thirdDimension,
      fourth: fourthDimension,
      sort: sortMetric,
    }),
    [fourthDimension, leadDimension, secondDimension, sortMetric, thirdDimension],
  );
  const sortOptions = useMemo(
    () => [...activeDimensionOptions(leadDimension, secondDimension, thirdDimension, fourthDimension), ...METRIC_OPTIONS],
    [fourthDimension, leadDimension, secondDimension, thirdDimension],
  );
  const dimensionOptions = useMemo(
    () => DIMENSION_OPTIONS.filter((option) => canViewNamedPeople || option.key !== "person"),
    [canViewNamedPeople],
  );
  const optionalDimensionOptions = useMemo(
    () => [{ key: "none" as const, label: "None" }, ...dimensionOptions],
    [dimensionOptions],
  );

  useEffect(() => {
    if (canViewNamedPeople) return;
    if (leadDimension === "person") setLeadDimension("product");
    if (secondDimension === "person") setSecondDimension("bucket");
    if (thirdDimension === "person") setThirdDimension("none");
    if (fourthDimension === "person") setFourthDimension("none");
  }, [canViewNamedPeople, fourthDimension, leadDimension, secondDimension, thirdDimension]);

  useEffect(() => {
    if (!sortOptions.some((option) => option.key === sortMetric)) {
      setSortMetric("forecast_cost");
    }
  }, [sortMetric, sortOptions]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .laborCostReport(fiscalYear, reportParams)
      .then(setReport)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load labor cost report"))
      .finally(() => setLoading(false));
  }, [fiscalYear, reportParams]);

  useEffect(() => {
    setRangeStart(`${fiscalYear - 1}-07-01`);
    setRangeEnd(`${fiscalYear}-06-30`);
    setSelectedMonth("1");
  }, [fiscalYear]);

  const exportReport = useCallback(async (startDate?: string, endDate?: string) => {
    setExporting(true);
    setExportError(null);
    try {
      const { blob, filename } = await api.exportLaborCostReport(fiscalYear, { ...reportParams, startDate, endDate });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Unable to export labor cost report");
    } finally {
      setExporting(false);
    }
  }, [fiscalYear, reportParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-foreground">Reports</h1>
          <p className="mt-1 text-muted-foreground">
            Enterprise labor cost rollups for {fiscalYearLabel} ({fiscalYearRangeLabel}).
          </p>
        </div>
        <PageNav current="reports" />
      </div>

      <div className="border-t" />

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileSpreadsheet className="h-5 w-5" />
                Labor Cost Report
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Pivot forecast and actual cost by Product, Bucket, Role, Employment Type, Person, and Team. {canViewTeamMemberProfiles ? "Product and Person values" : "Product values"} link back to their detail pages.
              </p>
            </div>
            <Button onClick={() => setPeriodDialogOpen(true)} disabled={exporting || loading || !report}>
              <Download className="h-4 w-4" />
              Export XLSX
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <DimensionSelect
              label="Lead Column"
              value={leadDimension}
              options={dimensionOptions}
              onChange={(value) => setLeadDimension(value as LaborCostReportDimension)}
            />
            <DimensionSelect
              label="Then"
              value={secondDimension}
              options={optionalDimensionOptions}
              onChange={(value) => setSecondDimension(value as LaborCostReportOptionalDimension)}
            />
            <DimensionSelect
              label="Then"
              value={thirdDimension}
              options={optionalDimensionOptions}
              onChange={(value) => setThirdDimension(value as LaborCostReportOptionalDimension)}
            />
            <DimensionSelect
              label="Then"
              value={fourthDimension}
              options={optionalDimensionOptions}
              onChange={(value) => setFourthDimension(value as LaborCostReportOptionalDimension)}
            />
            <DimensionSelect label="Sort By" value={sortMetric} options={sortOptions} onChange={(value) => setSortMetric(value as LaborCostReportSort)} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {exportError ? <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{exportError}</div> : null}
          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} /> : report ? <LaborCostReportTable report={report} /> : null}
        </CardContent>
      </Card>

      {periodDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPeriodDialogOpen(false); }}>
          <section aria-labelledby="report-period-title" aria-modal="true" className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground" id="report-period-title">Choose report period</h2>
                <p className="mt-1 text-sm text-muted-foreground">Export labor cost data for FY{fiscalYear}.</p>
              </div>
              <Button aria-label="Close period selector" variant="outline" onClick={() => setPeriodDialogOpen(false)}>×</Button>
            </div>

            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">Report period</legend>
              <PeriodChoice label={`Full fiscal year (FY${fiscalYear})`} value="year" selected={exportPeriod} onSelect={setExportPeriod} />
              <PeriodChoice label="One fiscal month" value="month" selected={exportPeriod} onSelect={setExportPeriod} />
              {exportPeriod === "month" ? (
                <label className="ml-7 block space-y-1">
                  <span className="text-sm font-medium">Fiscal month</span>
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                    {Array.from({ length: 12 }, (_, index) => {
                      const sequence = index + 1;
                      return <option key={sequence} value={String(sequence)}>{fiscalMonthLabel(fiscalYear, sequence)}</option>;
                    })}
                  </select>
                </label>
              ) : null}
              <PeriodChoice label="Date range" value="range" selected={exportPeriod} onSelect={setExportPeriod} />
              {exportPeriod === "range" ? (
                <div className="ml-7 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium">From</span>
                    <input aria-label="Range start date" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="date" min={`${fiscalYear - 1}-07-01`} max={`${fiscalYear}-06-30`} value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Through</span>
                    <input aria-label="Range end date" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" type="date" min={`${fiscalYear - 1}-07-01`} max={`${fiscalYear}-06-30`} value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                  </label>
                  <p className="text-xs text-muted-foreground sm:col-span-2">Report data is stored by fiscal month, so each month touched by this date range is included in full.</p>
                </div>
              ) : null}
            </fieldset>

            {exportError ? <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{exportError}</div> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPeriodDialogOpen(false)}>Cancel</Button>
              <Button disabled={exporting || (exportPeriod === "range" && (!rangeStart || !rangeEnd || rangeStart > rangeEnd))} onClick={() => {
                let startDate: string | undefined;
                let endDate: string | undefined;
                if (exportPeriod === "month") {
                  const bounds = fiscalMonthBounds(fiscalYear, Number(selectedMonth));
                  startDate = bounds.start;
                  endDate = bounds.end;
                } else if (exportPeriod === "range") {
                  startDate = rangeStart;
                  endDate = rangeEnd;
                }
                setPeriodDialogOpen(false);
                void exportReport(startDate, endDate);
              }}>
                <Download className="h-4 w-4" />
                {exporting ? "Exporting" : "Export report"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PeriodChoice({ label, value, selected, onSelect }: { label: string; value: "year" | "month" | "range"; selected: string; onSelect: (value: "year" | "month" | "range") => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium hover:bg-secondary/50">
      <input checked={selected === value} name="report-period" type="radio" value={value} onChange={() => onSelect(value)} />
      {label}
    </label>
  );
}

function fiscalMonthBounds(fiscalYear: number, sequence: number) {
  const monthIndex = (6 + sequence - 1) % 12;
  const year = fiscalYear - (sequence <= 6 ? 1 : 0);
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function fiscalMonthLabel(fiscalYear: number, sequence: number) {
  const { start, end } = fiscalMonthBounds(fiscalYear, sequence);
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return `${startDate.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} (${start} – ${end})`;
}

function LaborCostReportTable({ report }: { report: LaborCostReport }) {
  const rows = report.rows;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <ReportMetric label="Forecast Cost" value={formatCurrency(report.totals.forecast_cost)} />
        <ReportMetric label="Actual Cost" value={formatCurrency(report.totals.actual_cost)} />
        <ReportMetric label="Variance Cost" value={formatCurrency(report.totals.variance_cost)} tone={report.totals.variance_cost > 0 ? "warn" : "default"} />
        <ReportMetric label="Rows" value={formatHours(rows.length)} />
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/70 hover:bg-secondary/70">
              {report.dimensions.map((dimension) => (
                <TableHead key={dimension.key}>{dimension.label}</TableHead>
              ))}
              <TableHead className="text-right">Forecast Hrs</TableHead>
              <TableHead className="text-right">Forecast Cost</TableHead>
              <TableHead className="text-right">Actual Hrs</TableHead>
              <TableHead className="text-right">Actual Cost</TableHead>
              <TableHead className="text-right">Variance Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={report.dimensions.length + 5}>
                  No labor cost rows exist for this fiscal year yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => <LaborCostReportBodyRow key={reportRowKey(row)} row={row} />)
            )}
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableCell className="font-semibold text-primary" colSpan={report.dimensions.length}>
                Total
              </TableCell>
              <TableCell className="numeric-cell text-right font-semibold">{formatHours(report.totals.forecast_hours)}</TableCell>
              <TableCell className="numeric-cell text-right font-semibold text-primary">{formatCurrency(report.totals.forecast_cost)}</TableCell>
              <TableCell className="numeric-cell text-right font-semibold">{formatHours(report.totals.actual_hours)}</TableCell>
              <TableCell className="numeric-cell text-right font-semibold text-primary">{formatCurrency(report.totals.actual_cost)}</TableCell>
              <TableCell className="numeric-cell text-right font-semibold">{formatCurrency(report.totals.variance_cost)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LaborCostReportBodyRow({ row }: { row: LaborCostReportRow }) {
  return (
    <TableRow>
      {row.dimension_values.map((value) => (
        <TableCell key={`${value.key}:${value.label}`} className="font-medium">
          {value.href ? (
            <Link className="text-primary hover:underline" to={value.href}>
              {value.label}
            </Link>
          ) : (
            value.label
          )}
        </TableCell>
      ))}
      <TableCell className="numeric-cell text-right">{formatHours(row.forecast_hours)}</TableCell>
      <TableCell className="numeric-cell text-right font-medium text-primary">{formatCurrency(row.forecast_cost)}</TableCell>
      <TableCell className="numeric-cell text-right">{formatHours(row.actual_hours)}</TableCell>
      <TableCell className="numeric-cell text-right font-medium text-primary">{formatCurrency(row.actual_cost)}</TableCell>
      <TableCell className="numeric-cell text-right">{formatCurrency(row.variance_cost)}</TableCell>
    </TableRow>
  );
}

function DimensionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReportMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className="rounded-md bg-secondary/70 px-4 py-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className={cn("numeric-cell mt-1 text-xl font-semibold text-primary", tone === "warn" && "text-warning")}>{value}</div>
    </div>
  );
}

function reportRowKey(row: LaborCostReportRow) {
  return row.dimension_values.map((value) => `${value.key}:${value.label}`).join("|");
}

function activeDimensionOptions(
  leadDimension: LaborCostReportDimension,
  secondDimension: LaborCostReportOptionalDimension,
  thirdDimension: LaborCostReportOptionalDimension,
  fourthDimension: LaborCostReportOptionalDimension,
) {
  const selectedDimensions = [leadDimension, secondDimension, thirdDimension, fourthDimension];
  const seen = new Set<string>();
  return selectedDimensions
    .filter((dimension): dimension is LaborCostReportDimension => dimension !== "none")
    .filter((dimension) => {
      if (seen.has(dimension)) return false;
      seen.add(dimension);
      return true;
    })
    .map((dimension) => DIMENSION_OPTIONS.find((option) => option.key === dimension) ?? { key: dimension, label: dimension });
}
