import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Download, Users, CalendarDays, HardHat, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend } from "recharts";
import { format, subDays, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClientOnly } from "@tanstack/react-router";
import { ScreenGuard } from "@/components/ScreenGuard";
import { PageHeader } from "@/components/PageHeader";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { DlrDailyPreview } from "@/components/DlrDailyPreview";
import { getDlrDailyMatrix, downloadDlrXlsx, downloadDlrCsv } from "@/lib/dlr-daily";
import { FileSpreadsheet, FileText } from "lucide-react";

export const Route = createFileRoute("/reports")({
  component: () => (
    <ScreenGuard screen="reports">
      <ClientOnly fallback={<div className="p-8 text-center text-muted-foreground">Loading reports...</div>}>
        <ReportsPage />
      </ClientOnly>
    </ScreenGuard>
  ),
});

function DatePicker({ value, onChange, label }: { value: Date; onChange: (d: Date) => void; label: string }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full sm:w-[170px] justify-start text-left font-normal")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(value, "dd MMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={(d) => d && onChange(d)} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BreakdownCard({ title, icon: Icon, rows, total, accent }: { title: string; icon: any; rows: [string, number][]; total: number; accent: string }) {
  const top = rows.slice(0, 6);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${accent}`} />
      </CardHeader>
      <CardContent className="space-y-2">
        {top.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
        {top.map(([label, count]) => {
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="truncate" title={label}>{label}</span>
                <span className="font-semibold tabular-nums shrink-0">{count} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full bg-current ${accent}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {rows.length > 6 && <p className="text-xs text-muted-foreground pt-1">+{rows.length - 6} more</p>}
      </CardContent>
    </Card>
  );
}

function ReportsPage() {
  const [tab, setTab] = useState("daily");
  
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 29));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("all");
  const [contractorId, setContractorId] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [projectGroup, setProjectGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState<{ type: "project" | "contractor"; key: string; label: string } | null>(null);

  useEffect(() => { loadMasters(); }, []);
  useEffect(() => { loadReport(); }, [tab, dateFrom, dateTo, projectId, contractorId, departmentId, categoryId, projectGroup]);

  const loadMasters = async () => {
    const [p, c, d, cat] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("contractors").select("*").order("company_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("worker_categories").select("*").order("name"),
    ]);
    setProjects(p.data || []);
    setContractors(c.data || []);
    setDepartments(d.data || []);
    setCategories(cat.data || []);
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      let query = supabase.from("daily_manpower").select("*, projects(name, code, project_group), contractors(company_name, nature_of_work), departments(name), worker_categories(name)");

      query = query
        .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("entry_date", format(dateTo, "yyyy-MM-dd"));

      if (projectId !== "all") query = query.eq("project_id", projectId);
      if (contractorId !== "all") query = query.eq("contractor_id", contractorId);
      if (departmentId !== "all") query = query.eq("department_id", departmentId);
      if (categoryId !== "all") query = query.eq("category_id", categoryId);

      const { data: result, error } = await query.order("entry_date", { ascending: false });
      if (error) {
        console.error("Report query error:", error);
        setData([]);
      } else {
        setData(result || []);
      }
    } catch (err) {
      console.error("Report load error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const getName = (obj: any) => obj?.name || obj?.company_name || "—";

  const projectGroups = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => p.project_group && set.add(p.project_group));
    return Array.from(set).sort();
  }, [projects]);

  const visibleProjects = useMemo(
    () => projectGroup === "all" ? projects : projects.filter((p) => p.project_group === projectGroup),
    [projects, projectGroup]
  );

  const filtered = useMemo(() => {
    let arr = data;
    if (projectGroup !== "all") arr = arr.filter((r) => r.projects?.project_group === projectGroup);
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter((r) =>
      [getName(r.projects), r.projects?.code, r.projects?.project_group, getName(r.contractors), getName(r.departments), getName(r.worker_categories), r.remarks]
        .some((v) => (v || "").toString().toLowerCase().includes(q))
    );
  }, [data, search, projectGroup]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + (r.headcount || 0), 0);
    const days = new Set(filtered.map((r) => r.entry_date)).size;
    const conts = new Set(filtered.map((r) => r.contractor_id)).size;
    const avg = days ? Math.round(total / days) : 0;
    return { total, days, conts, avg };
  }, [filtered]);

  const groupBy = (keyFn: (r: any) => string) => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const k = keyFn(r) || "—";
      map.set(k, (map.get(k) || 0) + (r.headcount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };

  const byDepartment = useMemo(() => groupBy((r) => getName(r.departments)), [filtered]);
  const byProject = useMemo(() => groupBy((r) => r.projects?.code ? `[${r.projects.code}] ${getName(r.projects)}` : getName(r.projects)), [filtered]);
  const byContractor = useMemo(() => groupBy((r) => getName(r.contractors)), [filtered]);
  const byCategory = useMemo(() => groupBy((r) => getName(r.worker_categories)), [filtered]);

  // Aggregated rows for Project-wise / Contractor-wise tabs
  type AggRow = { key: string; label: string; sub?: string; headcount: number; days: Set<string>; entries: number };
  const aggregate = (keyFn: (r: any) => { key: string; label: string; sub?: string }) => {
    const map = new Map<string, AggRow>();
    filtered.forEach((r) => {
      const { key, label, sub } = keyFn(r);
      if (!map.has(key)) map.set(key, { key, label, sub, headcount: 0, days: new Set(), entries: 0 });
      const row = map.get(key)!;
      row.headcount += r.headcount || 0;
      row.days.add(r.entry_date);
      row.entries += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.headcount - a.headcount);
  };

  const projectAgg = useMemo(() => aggregate((r) => ({
    key: r.project_id || "—",
    label: getName(r.projects),
    sub: r.projects?.code || r.projects?.project_group || "",
  })), [filtered]);

  const contractorAgg = useMemo(() => aggregate((r) => ({
    key: r.contractor_id || "—",
    label: getName(r.contractors),
    sub: r.contractors?.nature_of_work || "",
  })), [filtered]);

  const applyPreset = (preset: string) => {
    const today = new Date();
    if (preset === "today") { setDateFrom(today); setDateTo(today); }
    else if (preset === "7d") { setDateFrom(subDays(today, 6)); setDateTo(today); }
    else if (preset === "30d") { setDateFrom(subDays(today, 29)); setDateTo(today); }
    else if (preset === "mtd") { setDateFrom(startOfMonth(today)); setDateTo(today); }
  };

  const resetFilters = () => {
    setProjectId("all"); setContractorId("all"); setDepartmentId("all"); setCategoryId("all"); setProjectGroup("all"); setSearch("");
  };

  const exportCsv = () => {
    const headers = ["Date", "Project Code", "Project", "Project Group", "Contractor", "Department", "Category", "Headcount", "Remarks"];
    const rows = filtered.map((r) => [
      r.entry_date, r.projects?.code || "", getName(r.projects), r.projects?.project_group || "",
      getName(r.contractors), getName(r.departments), getName(r.worker_categories),
      r.headcount, r.remarks || ""
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c: any) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dlax-report-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    { title: "Total Workers", value: stats.total, icon: Users, color: "text-primary" },
    { title: "Avg Workers/Day", value: stats.avg, icon: TrendingUp, color: "text-chart-3" },
    { title: "Active Days", value: stats.days, icon: CalendarDays, color: "text-chart-4" },
    { title: "Contractors", value: stats.conts, icon: HardHat, color: "text-accent" },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Reports"
        subtitle="View and export workforce reports"
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4 md:space-y-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="project">Project</TabsTrigger>
          <TabsTrigger value="contractor">Contractor</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => applyPreset("today")}>Today</Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset("7d")}>Last 7 days</Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset("30d")}>Last 30 days</Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset("mtd")}>Month to date</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-end">
              <DatePicker value={dateFrom} onChange={setDateFrom} label="From" />
              <DatePicker value={dateTo} onChange={setDateTo} label="To" />
              <div className="space-y-1 min-w-0">
                <Label>Project Group</Label>
                <Select value={projectGroup} onValueChange={(v) => { setProjectGroup(v); setProjectId("all"); }}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {projectGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-0">
                <Label>Project</Label>
                <ProjectCombobox
                  value={projectId}
                  onChange={setProjectId}
                  projects={visibleProjects}
                  includeAllOption
                  className="w-full sm:w-[220px]"
                  formatLabel={(p) => [p.code && `[${p.code}]`, p.name, p.project_group && `— ${p.project_group}`].filter(Boolean).join(" ")}
                />
              </div>
              <div className="space-y-1 min-w-0">
                <Label>Contractor</Label>
                <Select value={contractorId} onValueChange={setContractorId}>
                  <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contractors</SelectItem>
                    {contractors.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-0">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-0">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-0">
                <Label>Search</Label>
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-[200px]" />
              </div>
              <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Breakdown boxes */}
        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownCard title="By Department" icon={Users} rows={byDepartment} total={stats.total} accent="text-primary" />
          <BreakdownCard title="By Project" icon={HardHat} rows={byProject} total={stats.total} accent="text-accent" />
          <BreakdownCard title="By Category" icon={TrendingUp} rows={byCategory} total={stats.total} accent="text-chart-3" />
        </div>

        {/* Results */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {tab === "daily" && `Daily Entries (${filtered.length})`}
                {tab === "project" && `Project-wise Summary (${projectAgg.length})`}
                {tab === "contractor" && `Contractor-wise Summary (${contractorAgg.length})`}
              </CardTitle>
              <div className="flex gap-4 text-sm flex-wrap">
                <span>Workers: <strong>{stats.total}</strong></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {tab === "daily" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>}
                    {!loading && filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.entry_date}</TableCell>
                        <TableCell className="font-mono text-xs">{r.projects?.code || "—"}</TableCell>
                        <TableCell>{getName(r.projects)}</TableCell>
                        <TableCell>{r.projects?.project_group || "—"}</TableCell>
                        <TableCell>{getName(r.contractors)}</TableCell>
                        <TableCell>{getName(r.departments)}</TableCell>
                        <TableCell>{getName(r.worker_categories)}</TableCell>
                        <TableCell className="text-right font-medium">{r.headcount}</TableCell>
                        <TableCell className="text-muted-foreground">{r.remarks || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No data found for selected filters</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}

              {(tab === "project" || tab === "contractor") && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tab === "project" ? "Project" : "Contractor"}</TableHead>
                      <TableHead>{tab === "project" ? "Code / Group" : "Nature of Work"}</TableHead>
                      <TableHead className="text-right">Total Workers</TableHead>
                      <TableHead className="text-right">Active Days</TableHead>
                      <TableHead className="text-right">Avg / Day</TableHead>
                      <TableHead className="text-right">Entries</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>}
                    {!loading && (tab === "project" ? projectAgg : contractorAgg).map((row) => {
                      const days = row.days.size;
                      const avg = days ? Math.round(row.headcount / days) : 0;
                      const pct = stats.total ? Math.round((row.headcount / stats.total) * 100) : 0;
                      return (
                        <TableRow
                          key={row.key}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setDrill({ type: tab as "project" | "contractor", key: row.key, label: row.label })}
                        >
                          <TableCell className="font-medium text-primary underline-offset-2 hover:underline">{row.label}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{row.sub || "—"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{row.headcount}</TableCell>
                          <TableCell className="text-right tabular-nums">{days}</TableCell>
                          <TableCell className="text-right tabular-nums">{avg}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.entries}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct}%</TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && (tab === "project" ? projectAgg : contractorAgg).length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No data found for selected filters</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </Tabs>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {drill?.type === "project" ? "Project" : "Contractor"} Detail — {drill?.label}
            </DialogTitle>
          </DialogHeader>
          {drill && (() => {
            const rows = filtered.filter((r) =>
              drill.type === "project" ? r.project_id === drill.key : r.contractor_id === drill.key
            );
            const total = rows.reduce((s, r) => s + (r.headcount || 0), 0);
            // Split-by axis: contractor when drilling into a project, project when drilling into a contractor
            const splitKeyOf = (r: any) =>
              drill.type === "project"
                ? { id: r.contractor_id || "—", name: getName(r.contractors) }
                : { id: r.project_id || "—", name: getName(r.projects) };
            // Compute totals per split to pick top series + sort dates
            const splitTotals = new Map<string, { name: string; total: number }>();
            const dateSet = new Set<string>();
            rows.forEach((r) => {
              const s = splitKeyOf(r);
              dateSet.add(r.entry_date);
              const cur = splitTotals.get(s.id) || { name: s.name, total: 0 };
              cur.total += r.headcount || 0;
              splitTotals.set(s.id, cur);
            });
            const TOP_N = 6;
            const sortedSplits = Array.from(splitTotals.entries()).sort((a, b) => b[1].total - a[1].total);
            const topSplits = sortedSplits.slice(0, TOP_N);
            const otherIds = new Set(sortedSplits.slice(TOP_N).map(([id]) => id));
            const seriesKeys = topSplits.map(([id, v]) => ({ id, name: v.name }));
            if (otherIds.size > 0) seriesKeys.push({ id: "__other__", name: "Other" });
            // Build per-date stacked datapoints
            const dates = Array.from(dateSet).sort();
            const trend = dates.map((date) => {
              const point: Record<string, any> = { date: format(new Date(date), "dd MMM"), _total: 0 };
              seriesKeys.forEach((s) => (point[s.id] = 0));
              return { date, point };
            });
            const trendIdx = new Map(trend.map((t, i) => [t.date, i]));
            rows.forEach((r) => {
              const idx = trendIdx.get(r.entry_date);
              if (idx === undefined) return;
              const s = splitKeyOf(r);
              const key = otherIds.has(s.id) ? "__other__" : s.id;
              trend[idx].point[key] = (trend[idx].point[key] || 0) + (r.headcount || 0);
              trend[idx].point._total += r.headcount || 0;
            });
            const chartData = trend.map((t) => t.point);
            const peak = chartData.reduce((m, p) => Math.max(m, p._total || 0), 0);
            // Palette using design tokens
            const palette = [
              "hsl(var(--primary))",
              "hsl(var(--accent))",
              "hsl(var(--chart-3))",
              "hsl(var(--chart-4))",
              "hsl(var(--chart-5))",
              "hsl(var(--chart-2))",
              "hsl(var(--muted-foreground))",
            ];
            return (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {rows.length} entries · <strong className="text-foreground">{total}</strong> total workers · Peak day: <strong className="text-foreground">{peak}</strong> · Split by {drill.type === "project" ? "contractor" : "project"}
                </div>
                {chartData.length > 0 && (
                  <div className="h-64 w-full rounded-md border bg-muted/20 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={32} />
                        <RTooltip
                          contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {seriesKeys.map((s, i) => (
                          <Area
                            key={s.id}
                            type="monotone"
                            dataKey={s.id}
                            name={s.name}
                            stackId="1"
                            stroke={palette[i % palette.length]}
                            fill={palette[i % palette.length]}
                            fillOpacity={0.55}
                            strokeWidth={1.5}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {drill.type === "project" ? <TableHead>Contractor</TableHead> : <TableHead>Project</TableHead>}
                      <TableHead>Department</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.entry_date}</TableCell>
                        <TableCell>{drill.type === "project" ? getName(r.contractors) : getName(r.projects)}</TableCell>
                        <TableCell>{getName(r.departments)}</TableCell>
                        <TableCell>{getName(r.worker_categories)}</TableCell>
                        <TableCell className="text-right font-medium">{r.headcount}</TableCell>
                        <TableCell className="text-muted-foreground">{r.remarks || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
