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
import { CalendarIcon, Download, Users, CalendarDays, HardHat, TrendingUp, Loader2 } from "lucide-react";

import { format, subDays, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientOnly } from "@tanstack/react-router";
import { ScreenGuard } from "@/components/ScreenGuard";
import { PageHeader } from "@/components/PageHeader";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { DlrDailyPreview } from "@/components/DlrDailyPreview";
import { getDlrDailyMatrix, downloadDlrXlsx, downloadDlrCsv } from "@/lib/dlr-daily";
import { downloadDlrMatrixXlsx } from "@/lib/dlr-daily-matrix";
import { downloadSummaryMatrixXlsx } from "@/lib/summary-matrix-xlsx";
import { FileSpreadsheet, FileText, LayoutGrid } from "lucide-react";

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
          <TabsTrigger value="dlr">Daily Labour Report</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>


        {tab === "dlr" && <DlrTab projects={projects} />}
        {tab === "summary" && <SummaryTab projects={projects} />}
        {tab !== "dlr" && tab !== "summary" && (
        <>


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


            </div>
          </CardContent>
        </Card>
        </>
        )}
      </Tabs>



    </div>
  );
}

function DlrTab({ projects }: { projects: any[] }) {
  const [projectId, setProjectId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  useEffect(() => {
    if (!projectId) { setRows([]); setDepartments([]); setDepartmentIds([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const dateStr = format(date, "yyyy-MM-dd");
      const dmRes = await supabase
        .from("daily_manpower")
        .select("*, departments(id, name), worker_categories(id, name, display_order)")
        .eq("project_id", projectId)
        .eq("entry_date", dateStr);
      if (cancelled) return;

      if (dmRes.error) console.error(dmRes.error);
      const dmRows = dmRes.data || [];

      // Build department -> categories strictly from actual records for the selected date
      const byDept = new Map<string, { id: string; name: string; isNmr: boolean; categories: Map<string, { id: string; name: string; display_order: number }> }>();
      for (const r of dmRows) {
        const dept: any = (r as any).departments;
        const cat: any = (r as any).worker_categories;
        if (!dept || !cat) continue;
        if (!byDept.has(dept.id)) byDept.set(dept.id, { id: dept.id, name: dept.name, isNmr: /nmr/i.test(dept.name), categories: new Map() });
        const entry = byDept.get(dept.id)!;
        if (!entry.categories.has(cat.id)) {
          entry.categories.set(cat.id, { id: cat.id, name: cat.name, display_order: cat.display_order || 0 });
        }
      }
      const deptEntries = Array.from(byDept.values())
        .map((d) => ({
          id: d.id,
          name: d.name,
          isNmr: d.isNmr,
          categories: Array.from(d.categories.values())
            .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
            .map(({ id, name }) => ({ id, name })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setRows(dmRows);
      setDepartments(deptEntries.map(({ name, isNmr, categories }) => ({ name, isNmr, categories })));
      setDepartmentIds(deptEntries.map((d) => d.id));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, date]);

  const matrix = useMemo(() => {
    if (!project) return null;
    return getDlrDailyMatrix({ project, date, rows, departments, departmentIds });
  }, [project, date, rows, departments, departmentIds]);


  const fileBase = project
    ? `DLR-${(project.code || project.name).toString().replace(/[^A-Za-z0-9_-]+/g, "_")}-${format(date, "dd-MM-yyyy")}`
    : "DLR";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daily Labour Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1 min-w-0">
              <Label>Project</Label>
              <ProjectCombobox
                value={projectId}
                onChange={setProjectId}
                projects={projects}
                className="w-full"
                formatLabel={(p) => [p.code && `[${p.code}]`, p.name].filter(Boolean).join(" ")}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
              <Button
                onClick={() => matrix && downloadDlrXlsx(matrix, `${fileBase}.xlsx`)}
                disabled={!matrix}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => matrix && downloadDlrCsv(matrix, `${fileBase}.csv`)}
                disabled={!matrix}
              >
                <FileText className="mr-2 h-4 w-4" /> Download CSV
              </Button>
            </div>
          </div>
          {!projectId && (
            <p className="text-sm text-muted-foreground">Select a project and date to preview and download the report.</p>
          )}
          {projectId && loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {projectId && !loading && matrix && <DlrDailyPreview matrix={matrix} />}
        </CardContent>
      </Card>
    </div>
  );
}

function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

type SummaryColumn =
  | { kind: "day"; date: Date; key: string }
  | { kind: "avg"; week: number; key: string }
  | { kind: "month"; key: string };

function SummaryTab({ projects }: { projects: any[] }) {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState<string>("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("daily_manpower")
        .select("entry_date, headcount, project_id, projects(name, code)")
        .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("entry_date", format(dateTo, "yyyy-MM-dd"))
        .eq("status", "approved");
      if (projectId !== "all") q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) { console.error(error); setRows([]); }
      else setRows(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, projectId]);

  const matrix = useMemo(() => {
    // Build day list
    const days: Date[] = [];
    const cur = new Date(dateFrom);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(dateTo);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }

    // Build columns: days, with an avg column inserted at each ISO week boundary
    const columns: SummaryColumn[] = [];
    const weekGroups: { weekKey: string; week: number; dayKeys: string[] }[] = [];
    let curGroup: { weekKey: string; week: number; dayKeys: string[] } | null = null;
    for (const d of days) {
      const { year, week } = isoWeek(d);
      const wKey = `${year}-W${week}`;
      const dKey = format(d, "yyyy-MM-dd");
      if (!curGroup || curGroup.weekKey !== wKey) {
        if (curGroup) {
          columns.push({ kind: "avg", week: curGroup.week, key: `avg-${curGroup.weekKey}` });
          weekGroups.push(curGroup);
        }
        curGroup = { weekKey: wKey, week, dayKeys: [] };
      }
      columns.push({ kind: "day", date: d, key: dKey });
      curGroup.dayKeys.push(dKey);
    }
    if (curGroup) {
      columns.push({ kind: "avg", week: curGroup.week, key: `avg-${curGroup.weekKey}` });
      weekGroups.push(curGroup);
    }
    columns.push({ kind: "month", key: "month-total" });

    // Aggregate: project -> dateKey -> total headcount
    const byProject = new Map<string, { id: string; name: string; code: string; daily: Map<string, number> }>();
    // Seed from selected projects so rows appear even with no data
    const seedProjects = projectId === "all"
      ? projects
      : projects.filter((p: any) => p.id === projectId);
    for (const p of seedProjects) {
      byProject.set(p.id, { id: p.id, name: p.name || "—", code: p.code || "", daily: new Map() });
    }
    for (const r of rows) {
      const pid = r.project_id || "—";
      const p: any = r.projects;
      if (!byProject.has(pid)) byProject.set(pid, { id: pid, name: p?.name || "—", code: p?.code || "", daily: new Map() });
      const proj = byProject.get(pid)!;
      proj.daily.set(r.entry_date, (proj.daily.get(r.entry_date) || 0) + (r.headcount || 0));
    }

    const projectRows = Array.from(byProject.values())
      .map((p) => {
        const dayVals: Record<string, number> = {};
        let monthTotal = 0;
        for (const d of days) {
          const k = format(d, "yyyy-MM-dd");
          const v = p.daily.get(k) || 0;
          dayVals[k] = v;
          monthTotal += v;
        }
        const weekAvgs: Record<string, number | null> = {};
        for (const g of weekGroups) {
          let sum = 0;
          let cnt = 0;
          for (const k of g.dayKeys) {
            const v = dayVals[k] || 0;
            if (v > 0) { sum += v; cnt += 1; }
          }
          weekAvgs[`avg-${g.weekKey}`] = cnt > 0 ? Math.round((sum / cnt) * 10) / 10 : null;
        }
        return { ...p, dayVals, weekAvgs, monthTotal };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Grand totals per column (avg across all approved entries that week, ignoring empty days)
    const colTotals: Record<string, number | null> = {};
    let grandMonth = 0;
    for (const c of columns) {
      if (c.kind === "day") {
        colTotals[c.key] = projectRows.reduce((s, p) => s + (p.dayVals[c.key] || 0), 0);
      } else if (c.kind === "avg") {
        const group = weekGroups.find((g) => `avg-${g.weekKey}` === c.key)!;
        let sum = 0;
        let cnt = 0;
        for (const p of projectRows) {
          for (const k of group.dayKeys) {
            const v = p.dayVals[k] || 0;
            if (v > 0) { sum += v; cnt += 1; }
          }
        }
        colTotals[c.key] = cnt > 0 ? Math.round((sum / cnt) * 10) / 10 : null;
      } else {
        const total = projectRows.reduce((s, p) => s + p.monthTotal, 0);
        colTotals[c.key] = total;
        grandMonth = total;
      }
    }

    const totalLabour = projectRows.reduce((s, p) => s + p.monthTotal, 0);
    const totalDays = days.length;
    const avgPerWeek = totalDays > 0 ? Math.round((totalLabour / (totalDays / 7)) * 10) / 10 : 0;

    return { columns, projectRows, colTotals, totalLabour, avgPerWeek, grandMonth, weeks: Math.round((totalDays / 7) * 10) / 10 };
  }, [rows, dateFrom, dateTo, projects, projectId]);

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const header1: any[] = ["KPC Projects Limited"];
    const header2: any[] = [`Manpower engaged from ${format(dateFrom, "dd MMM yyyy")} to ${format(dateTo, "dd MMM yyyy")}`];
    const head: any[] = ["S.No", "Project Name"];
    for (const c of matrix.columns) {
      if (c.kind === "day") head.push(format(c.date, "M/d/yyyy"));
      else if (c.kind === "avg") head.push(`Avg Week-${c.week}`);
      else head.push("Total Labour for the Month");
    }
    const body = matrix.projectRows.map((p, i) => {
      const row: any[] = [i + 1, p.code ? `[${p.code}] ${p.name}` : p.name];
      for (const c of matrix.columns) {
        if (c.kind === "day") row.push(p.dayVals[c.key] || 0);
        else if (c.kind === "avg") row.push(p.weekAvgs[c.key] ?? "");
        else row.push(p.monthTotal);
      }
      return row;
    });
    const totalRow: any[] = ["", "Grand Total"];
    for (const c of matrix.columns) totalRow.push(matrix.colTotals[c.key] ?? "");

    const aoa = [header1, header2, [], head, ...body, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFile(wb, `summary-${format(dateFrom, "yyyyMMdd")}-${format(dateTo, "yyyyMMdd")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Summary Report</CardTitle>
          <Button size="sm" variant="outline" onClick={exportXlsx} disabled={loading || matrix.projectRows.length === 0}>
            <Download className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
            <DatePicker value={dateFrom} onChange={setDateFrom} label="From Date" />
            <DatePicker value={dateTo} onChange={setDateTo} label="To Date" />
            <div className="space-y-1 min-w-0">
              <Label>Project</Label>
              <ProjectCombobox
                value={projectId === "all" ? "" : projectId}
                onChange={(v) => setProjectId(v || "all")}
                projects={[{ id: "", name: "All Projects", code: "" }, ...projects]}
                className="w-full"
                formatLabel={(p) => p.id === "" ? "All Projects" : [p.code && `[${p.code}]`, p.name].filter(Boolean).join(" ")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Labour Count</CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{matrix.totalLabour.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Labour / Week</CardTitle>
                <TrendingUp className="h-5 w-5 text-chart-3" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{matrix.avgPerWeek.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">over {matrix.weeks} weeks</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Labour for the Month</CardTitle>
                <CalendarDays className="h-5 w-5 text-chart-4" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{matrix.grandMonth.toLocaleString()}</div></CardContent>
            </Card>
          </div>

          <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/40">
              <div className="text-base font-semibold tracking-tight">KPC Projects Limited</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Manpower engaged from {format(dateFrom, "dd MMM yyyy")} to {format(dateTo, "dd MMM yyyy")}
              </div>
            </div>
            <div className="relative isolate max-h-[65vh] overflow-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-40 w-14 bg-secondary border-r border-b border-border px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">S.No</th>
                    <th className="sticky left-14 top-0 z-40 min-w-[240px] bg-secondary border-r border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide shadow-[1px_0_0_0_hsl(var(--border))]">Project Name</th>
                    {matrix.columns.map((c) => {
                      const base = "sticky top-0 z-30 border-r border-b border-border px-3 py-2 last:border-r-0 whitespace-nowrap text-center align-middle";
                      if (c.kind === "day") {
                        return (
                          <th key={c.key} className={cn(base, "bg-secondary min-w-[56px]")}>
                            <div className="text-sm font-bold leading-tight tabular-nums">{format(c.date, "d")}</div>
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">{format(c.date, "MMM")}</div>
                          </th>
                        );
                      }
                      if (c.kind === "avg") {
                        return (
                          <th key={c.key} className={cn(base, "bg-[oklch(0.94_0.05_55)] border-l-2 border-l-border min-w-[72px] text-[11px] font-semibold uppercase tracking-wide")}>
                            <div className="leading-tight">Avg</div>
                            <div className="leading-tight text-[10px] text-muted-foreground">W-{c.week}</div>
                          </th>
                        );
                      }
                      return (
                        <th key={c.key} className={cn(base, "bg-[oklch(0.9_0.08_55)] border-l-2 border-l-border min-w-[100px] text-[11px] font-semibold uppercase tracking-wide")}>
                          <div className="leading-tight">Month</div>
                          <div className="leading-tight">Total</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={2 + matrix.columns.length} className="border-b border-border p-0">
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
                          <span className="text-sm">Loading…</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && matrix.projectRows.length === 0 && (
                    <tr>
                      <td colSpan={2 + matrix.columns.length} className="border-b border-border p-0">
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Users className="h-8 w-8 text-muted-foreground/40" />
                          <span className="text-sm">No approved data in selected range</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && matrix.projectRows.map((p, i) => {
                    const zebra = i % 2 === 1;
                    const rowBg = zebra ? "bg-muted/20" : "bg-card";
                    const stickyBg = zebra ? "bg-muted" : "bg-background";
                    return (
                      <tr key={p.id} className="group">
                        <td className={cn("sticky left-0 z-20 w-14 border-r border-b border-border px-3 py-2.5 text-center text-xs tabular-nums text-muted-foreground", stickyBg)}>{i + 1}</td>
                        <td className={cn("sticky left-14 z-20 min-w-[240px] border-r border-b border-border px-3 py-2.5 whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]", stickyBg)}>
                          {p.code ? (
                            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground mr-2 align-middle">{p.code}</span>
                          ) : null}
                          <span className="font-medium text-foreground align-middle">{p.name}</span>
                        </td>
                        {matrix.columns.map((c) => {
                          const v = c.kind === "day" ? p.dayVals[c.key] || 0
                            : c.kind === "avg" ? p.weekAvgs[c.key]
                            : p.monthTotal;
                          const isNullish = v == null;
                          const isZero = typeof v === "number" && v === 0;
                          const bg = c.kind === "avg" ? "bg-[oklch(0.97_0.03_55)]"
                            : c.kind === "month" ? "bg-[oklch(0.94_0.06_55)] font-semibold"
                            : "";
                          const leftBorder = c.kind === "avg" || c.kind === "month" ? "border-l-2 border-l-border" : "";
                          const numClass = isNullish || isZero ? "text-muted-foreground/50" : "text-foreground";
                          return (
                            <td
                              key={c.key}
                              className={cn(
                                "border-r border-b border-border px-3 py-2.5 last:border-r-0 text-right tabular-nums group-hover:bg-primary/5",
                                rowBg, bg, leftBorder, numClass,
                              )}
                            >
                              {isNullish ? "—" : (v as number).toLocaleString()}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {!loading && matrix.projectRows.length > 0 && (
                    <tr>
                      <td className="sticky left-0 z-20 w-14 bg-secondary border-r border-t-2 border-b border-border px-3 py-2.5" />
                      <td className="sticky left-14 z-20 min-w-[240px] bg-secondary border-r border-t-2 border-b border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide shadow-[1px_0_0_0_hsl(var(--border))]">Grand Total</td>
                      {matrix.columns.map((c) => {
                        const v = matrix.colTotals[c.key];
                        const isNullish = v == null;
                        const bg = c.kind === "avg" ? "bg-[oklch(0.9_0.06_55)]"
                          : c.kind === "month" ? "bg-[oklch(0.86_0.09_55)]"
                          : "bg-muted";
                        const leftBorder = c.kind === "avg" || c.kind === "month" ? "border-l-2 border-l-border" : "";
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "border-r border-t-2 border-b border-border px-3 py-2.5 last:border-r-0 text-right tabular-nums font-semibold text-foreground",
                              bg, leftBorder,
                            )}
                          >
                            {isNullish ? "—" : (v as number).toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>

              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
