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
import { ProjectMultiCombobox } from "@/components/ProjectMultiCombobox";
import { DlrDailyPreview } from "@/components/DlrDailyPreview";
import { getDlrDailyMatrix, downloadDlrXlsx, downloadDlrCsv } from "@/lib/dlr-daily";
import { downloadDlrMatrixXlsx } from "@/lib/dlr-daily-matrix";
import { downloadSummaryMatrixXlsx } from "@/lib/summary-matrix-xlsx";
import { buildWeeklyMatrix, weeklyDateRangeLabel, type WeeklyMatrix } from "@/lib/weekly-report";
import { downloadWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { addDays } from "date-fns";
import { FileSpreadsheet, FileText, LayoutGrid, FileDown } from "lucide-react";

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

type ApprovalStatusFilter = "all" | "draft" | "pending" | "approved";

function applyApprovalStatus<T extends { eq: any; in: any }>(q: T, s: ApprovalStatusFilter): T {
  if (s === "approved") return q.eq("status", "approved");
  if (s === "draft") return q.eq("status", "draft");
  if (s === "pending") return q.in("status", ["pending_l1", "pending_l2"]);
  return q;
}

function ApprovalStatusSelect({ value, onChange, className }: { value: ApprovalStatusFilter; onChange: (v: ApprovalStatusFilter) => void; className?: string }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label>Status</Label>
      <Select value={value} onValueChange={(v) => onChange(v as ApprovalStatusFilter)}>
        <SelectTrigger className={cn("w-full sm:w-[160px]", className)}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// Alphabetical project ordering: by code when present, else by name (case-insensitive, natural).
const projectSortKey = (p: any) => (p?.code || p?.name || "").toString();
const cmpAlpha = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
export const compareProjects = (a: any, b: any) =>
  cmpAlpha(projectSortKey(a), projectSortKey(b)) ||
  cmpAlpha((a?.name || "").toString(), (b?.name || "").toString());


function ReportsPage() {
  const [tab, setTab] = useState("daily");
  
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 29));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("all");
  const [contractorId, setContractorId] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [projectGroup, setProjectGroup] = useState("all");
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  

  useEffect(() => { loadMasters(); }, []);
  useEffect(() => { loadReport(); }, [tab, dateFrom, dateTo, projectId, contractorId, departmentId, categoryId, projectGroup, approvalStatus]);

  const loadMasters = async () => {
    const [p, c, d, cat] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("contractors").select("*").order("company_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("worker_categories").select("*").order("name"),
    ]);
    setProjects([...(p.data || [])].sort(compareProjects));
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
      query = applyApprovalStatus(query as any, approvalStatus) as typeof query;

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
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((r) =>
        [getName(r.projects), r.projects?.code, r.projects?.project_group, getName(r.contractors), getName(r.departments), getName(r.worker_categories), r.remarks]
          .some((v) => (v || "").toString().toLowerCase().includes(q))
      );
    }
    return [...arr].sort(
      (a, b) =>
        compareProjects(a.projects, b.projects) ||
        (b.entry_date || "").localeCompare(a.entry_date || "") ||
        cmpAlpha(getName(a.contractors), getName(b.contractors))
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
  const byProject = useMemo(() => groupBy((r) => getName(r.projects)), [filtered]);
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
    setProjectId("all"); setContractorId("all"); setDepartmentId("all"); setCategoryId("all"); setProjectGroup("all"); setApprovalStatus("all"); setSearch("");
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
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="dlr">Daily Labour Report</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>


        {tab === "dlr" && <DlrTab projects={projects} approvalStatus={approvalStatus} setApprovalStatus={setApprovalStatus} />}
        {tab === "weekly" && <WeeklyTab projects={projects} approvalStatus={approvalStatus} setApprovalStatus={setApprovalStatus} />}
        {tab === "summary" && <SummaryTab projects={projects} approvalStatus={approvalStatus} setApprovalStatus={setApprovalStatus} />}
        {tab !== "dlr" && tab !== "summary" && tab !== "weekly" && (
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
                  formatLabel={(p) => p.name}
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
              <ApprovalStatusSelect value={approvalStatus} onChange={setApprovalStatus} />
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

function DlrTab({ projects, approvalStatus, setApprovalStatus }: { projects: any[]; approvalStatus: ApprovalStatusFilter; setApprovalStatus: (v: ApprovalStatusFilter) => void }) {
  const [projectId, setProjectId] = useState<string>("all");
  const [date, setDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedProjects = useMemo(() => {
    if (projectId === "all") return [...projects].sort(compareProjects);
    const p = projects.find((p) => p.id === projectId);
    return p ? [p] : [];
  }, [projects, projectId]);

  useEffect(() => {
    if (selectedProjects.length === 0) { setRows([]); setDepartments([]); setDepartmentIds([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const dateStr = format(date, "yyyy-MM-dd");
      let q = supabase
        .from("daily_manpower")
        .select("*, project_id, projects(id, code, name, project_group), departments(id, name), worker_categories(id, name, display_order)")
        .eq("entry_date", dateStr);
      if (projectId !== "all") q = q.eq("project_id", projectId);
      q = applyApprovalStatus(q as any, approvalStatus) as typeof q;
      const dmRes = await q;
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
      setDepartments(deptEntries.map(({ id, name, isNmr, categories }) => ({ id, name, isNmr, categories })));
      setDepartmentIds(deptEntries.map((d) => d.id));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, date, selectedProjects.length, approvalStatus]);

  const rowsByProject = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const pid = r.project_id as string;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(r);
    }
    return map;
  }, [rows]);

  const matrix = useMemo(() => {
    if (selectedProjects.length === 0) return null;
    return getDlrDailyMatrix({ projects: selectedProjects, date, rows, departments, departmentIds });
  }, [selectedProjects, date, rows, departments, departmentIds]);

  const matrixItems = useMemo(() => {
    if (!matrix || selectedProjects.length === 0) return [];
    return selectedProjects.map((p) => ({
      matrix: getDlrDailyMatrix({
        projects: [p],
        date,
        rows: rowsByProject.get(p.id) || [],
        departments,
        departmentIds,
      }),
      projectGroup: p.project_group,
    }));
  }, [matrix, selectedProjects, date, rowsByProject, departments, departmentIds]);

  const fileBase = projectId === "all"
    ? `DLR-AllProjects-${format(date, "dd-MM-yyyy")}`
    : selectedProjects[0]
    ? `DLR-${(selectedProjects[0].code || selectedProjects[0].name).toString().replace(/[^A-Za-z0-9_-]+/g, "_")}-${format(date, "dd-MM-yyyy")}`
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
                includeAllOption
                allLabel="All Projects"
                className="w-full"
                formatLabel={(p) => p.name}
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
            <ApprovalStatusSelect value={approvalStatus} onChange={setApprovalStatus} />
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-2">
              <Button
                onClick={() => matrix && downloadDlrXlsx(matrix, `${fileBase}.xlsx`)}
                disabled={!matrix}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button
                variant="secondary"
                onClick={() => matrixItems.length > 0 && downloadDlrMatrixXlsx(matrixItems, `${fileBase}-Matrix.xlsx`)}
                disabled={matrixItems.length === 0}
              >
                <LayoutGrid className="mr-2 h-4 w-4" /> Matrix Format
              </Button>
              <Button
                variant="outline"
                onClick={() => matrix && downloadDlrCsv(matrix, `${fileBase}.csv`)}
                disabled={!matrix}
              >
                <FileText className="mr-2 h-4 w-4" /> CSV
              </Button>
            </div>
          </div>
          {selectedProjects.length === 0 && (
            <p className="text-sm text-muted-foreground">Select a project and date to preview and download the report.</p>
          )}
          {selectedProjects.length > 0 && loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {selectedProjects.length > 0 && !loading && matrix && <DlrDailyPreview matrix={matrix} />}
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

function SummaryTab({ projects, approvalStatus, setApprovalStatus }: { projects: any[]; approvalStatus: ApprovalStatusFilter; setApprovalStatus: (v: ApprovalStatusFilter) => void }) {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("daily_manpower")
        .select("entry_date, headcount, project_id, projects(name, code, project_group)")
        .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("entry_date", format(dateTo, "yyyy-MM-dd"));
      if (projectIds.length > 0) q = q.in("project_id", projectIds);
      q = applyApprovalStatus(q as any, approvalStatus) as typeof q;
      const { data, error } = await q;
      if (cancelled) return;
      if (error) { console.error(error); setRows([]); }
      else setRows(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, projectIds, approvalStatus]);

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
    const byProject = new Map<string, { id: string; name: string; code: string; group: string | null; daily: Map<string, number> }>();
    // Seed from selected projects so rows appear even with no data
    const seedProjects = projectIds.length === 0
      ? projects
      : projects.filter((p: any) => projectIds.includes(p.id));
    for (const p of seedProjects) {
      byProject.set(p.id, { id: p.id, name: p.name || "—", code: p.code || "", group: p.project_group || null, daily: new Map() });
    }
    for (const r of rows) {
      const pid = r.project_id || "—";
      const p: any = r.projects;
      if (!byProject.has(pid)) byProject.set(pid, { id: pid, name: p?.name || "—", code: p?.code || "", group: p?.project_group || null, daily: new Map() });
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
      .sort(compareProjects);

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
  }, [rows, dateFrom, dateTo, projects, projectIds]);

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const totalCols = 2 + matrix.columns.length + 1; // S.No + Project + cols + Remarks
    const header1: any[] = ["KPC Projects Limited"];
    const header2: any[] = [`Manpower engaged from ${format(dateFrom, "dd MMM yyyy")} to ${format(dateTo, "dd MMM yyyy")}`];
    const head: any[] = ["S.No", "Project Name"];
    for (const c of matrix.columns) {
      if (c.kind === "day") head.push(format(c.date, "M/d/yyyy"));
      else if (c.kind === "avg") head.push(`Avg Week-${c.week}`);
      else head.push("Total Labour for the Month");
    }
    head.push("Remarks");

    // Group projects by project_group (same ordering as Matrix Format)
    const grouped = new Map<string, any[]>();
    for (const p of matrix.projectRows) {
      const g = p.group || "";
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(p);
    }
    const groups = Array.from(grouped.keys()).sort();

    const body: any[][] = [];
    let sno = 0;
    for (const g of groups) {
      if (g) {
        const groupRow: any[] = ["", g];
        for (let i = 2; i < totalCols; i++) groupRow.push("");
        body.push(groupRow);
      }
      for (const p of grouped.get(g)!) {
        sno++;
        const row: any[] = [sno, p.code ? `[${p.code}] ${p.name}` : p.name];
        for (const c of matrix.columns) {
          if (c.kind === "day") row.push(p.dayVals[c.key] || 0);
          else if (c.kind === "avg") row.push(p.weekAvgs[c.key] ?? "");
          else row.push(p.monthTotal);
        }
        row.push("");
        body.push(row);
      }
    }

    const totalRow: any[] = ["", "Grand Total"];
    for (const c of matrix.columns) totalRow.push(matrix.colTotals[c.key] ?? "");
    totalRow.push("");

    const aoa = [header1, header2, [], head, ...body, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Summary");
    XLSX.writeFile(wb, `summary-${format(dateFrom, "yyyyMMdd")}-${format(dateTo, "yyyyMMdd")}.xlsx`);
  };

  const exportMatrix = () => {
    downloadSummaryMatrixXlsx(
      {
        dateFrom, dateTo,
        columns: matrix.columns,
        projectRows: matrix.projectRows.map((p: any) => ({
          id: p.id, name: p.name, code: p.code, group: p.group,
          dayVals: p.dayVals, weekAvgs: p.weekAvgs, monthTotal: p.monthTotal,
        })),
        colTotals: matrix.colTotals,
      },
      `Summary-${format(dateFrom, "yyyyMMdd")}-${format(dateTo, "yyyyMMdd")}-Matrix.xlsx`,
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Summary Report</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={exportXlsx} disabled={loading || matrix.projectRows.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
            </Button>
            <Button size="sm" onClick={exportMatrix} disabled={loading || matrix.projectRows.length === 0}>
              <LayoutGrid className="h-4 w-4 mr-2" />Matrix Format
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
            <DatePicker value={dateFrom} onChange={setDateFrom} label="From Date" />
            <DatePicker value={dateTo} onChange={setDateTo} label="To Date" />
            <div className="space-y-1 min-w-0">
              <Label>Project</Label>
              <ProjectMultiCombobox
                value={projectIds}
                onChange={setProjectIds}
                projects={projects}
                className="w-full"
              />
            </div>
            <ApprovalStatusSelect value={approvalStatus} onChange={setApprovalStatus} />
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
                    <th className="sticky top-0 z-30 bg-secondary border-b border-border px-3 py-2 min-w-[160px] text-left text-xs font-semibold uppercase tracking-wide">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={3 + matrix.columns.length} className="border-b border-border p-0">
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
                          <span className="text-sm">Loading…</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && matrix.projectRows.length === 0 && (
                    <tr>
                      <td colSpan={3 + matrix.columns.length} className="border-b border-border p-0">
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Users className="h-8 w-8 text-muted-foreground/40" />
                          <span className="text-sm">No approved data in selected range</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loading && (() => {
                    // Group projects by project_group (mirror Matrix Format ordering)
                    const grouped = new Map<string, any[]>();
                    for (const p of matrix.projectRows) {
                      const g = p.group || "";
                      if (!grouped.has(g)) grouped.set(g, []);
                      grouped.get(g)!.push(p);
                    }
                    const groups = Array.from(grouped.keys()).sort();
                    const out: any[] = [];
                    let sno = 0;
                    let rowIdx = 0;
                    for (const g of groups) {
                      if (g) {
                        out.push(
                          <tr key={`grp-${g}`}>
                            <td className="sticky left-0 z-20 w-14 bg-[oklch(0.96_0.04_85)] border-r border-b border-border px-3 py-2" />
                            <td
                              colSpan={1 + matrix.columns.length + 1}
                              className="sticky-none bg-[oklch(0.96_0.04_85)] border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground shadow-[1px_0_0_0_hsl(var(--border))]"
                            >
                              {g}
                            </td>
                          </tr>
                        );
                      }
                      for (const p of grouped.get(g)!) {
                        sno++;
                        const zebra = rowIdx % 2 === 1;
                        rowIdx++;
                        const rowBg = zebra ? "bg-muted/20" : "bg-card";
                        const stickyBg = zebra ? "bg-muted" : "bg-background";
                        out.push(
                          <tr key={p.id} className="group">
                            <td className={cn("sticky left-0 z-20 w-14 border-r border-b border-border px-3 py-2.5 text-center text-xs tabular-nums text-muted-foreground", stickyBg)}>{sno}</td>
                            <td className={cn("sticky left-14 z-20 min-w-[240px] border-r border-b border-border px-3 py-2.5 whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]", stickyBg)}>
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
                            <td className={cn("border-b border-border px-3 py-2.5 text-xs text-muted-foreground min-w-[160px]", rowBg)} />
                          </tr>
                        );
                      }
                    }
                    return out;
                  })()}
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
                      <td className="bg-secondary border-t-2 border-b border-border px-3 py-2.5 min-w-[160px]" />
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

function WeeklyTab({ projects, approvalStatus, setApprovalStatus }: { projects: any[]; approvalStatus: ApprovalStatusFilter; setApprovalStatus: (v: ApprovalStatusFilter) => void }) {
  const [projectId, setProjectId] = useState<string>("");
  const [fromDate, setFromDate] = useState<Date>(() => new Date());
  const [toDate, setToDate] = useState<Date>(() => addDays(new Date(), 6));
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<WeeklyMatrix | null>(null);

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const invalidRange = toDate < fromDate;

  useEffect(() => {
    if (!projectId || !project || invalidRange) { setMatrix(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const start = format(fromDate, "yyyy-MM-dd");
      const end = format(toDate, "yyyy-MM-dd");
      let q = supabase
        .from("daily_manpower")
        .select("headcount, entry_date, contractor_id, contractors(id, company_name, contractor_code, nature_of_work), departments(name)")
        .eq("project_id", projectId)
        .gte("entry_date", start)
        .lte("entry_date", end);
      q = applyApprovalStatus(q as any, approvalStatus) as typeof q;
      const { data, error } = await q;
      if (cancelled) return;
      if (error) console.error(error);
      const m = buildWeeklyMatrix({
        project: { id: project.id, code: project.code, name: project.name },
        fromDate,
        toDate,
        entries: (data || []) as any,
      });
      setMatrix(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, project, fromDate, toDate, invalidRange, approvalStatus]);

  const fileBase = project
    ? `Weekly-Labour-Report-${(project.code || project.name).toString().replace(/[^A-Za-z0-9_-]+/g, "_")}-${format(fromDate, "ddMMyyyy")}-to-${format(toDate, "ddMMyyyy")}`
    : "Weekly-Labour-Report";

  const fmt = (n: number) => (n ? n.toLocaleString() : "");
  const N = matrix?.days.length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weekly Labour Report</CardTitle>
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
                formatLabel={(p) => p.name}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(fromDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate} onSelect={(d) => d && setFromDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1 min-w-0">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(toDate, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate} onSelect={(d) => d && setToDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <ApprovalStatusSelect value={approvalStatus} onChange={setApprovalStatus} />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => matrix && downloadWeeklyReportPdf(matrix, `${fileBase}.pdf`)}
                disabled={!matrix || matrix.rows.length === 0 || invalidRange}
              >
                <FileDown className="mr-2 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          {invalidRange && (
            <p className="text-sm text-destructive">To Date must be on or after From Date.</p>
          )}
          {!projectId && !invalidRange && (
            <p className="text-sm text-muted-foreground">Select a project and date range to preview the labour report.</p>
          )}
          {projectId && loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {projectId && !loading && matrix && !invalidRange && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 border rounded-md p-3 text-sm">
                <div>
                  <div className="font-semibold">Name of the Project:</div>
                  <div className="text-muted-foreground">{project?.name}</div>
                  <div className="mt-1 font-semibold">Date:</div>
                  <div className="text-muted-foreground">{weeklyDateRangeLabel(matrix)}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-base">KPC PROJECTS LTD</div>
                  <div className="font-semibold mt-1">WEEKLY LABOUR REPORT</div>
                </div>
                <div className="text-right">
                  <div className="inline-block border rounded px-3 py-1 font-bold text-lg">KPC</div>
                </div>
              </div>

              <div className="overflow-auto border rounded-md">
                <table className="border-collapse text-xs w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th rowSpan={2} className="border px-2 py-1 align-middle">S.No</th>
                      <th rowSpan={2} className="border px-2 py-1 align-middle">SC Code</th>
                      <th rowSpan={2} className="border px-2 py-1 align-middle text-left">Name of the Contractor</th>
                      <th rowSpan={2} className="border px-2 py-1 align-middle text-left">Nature of Work</th>
                      {matrix.days.map((d, i) => (
                        <th key={i} colSpan={2} className="border px-2 py-1 text-center">{format(d, "EEE dd.MM")}</th>
                      ))}
                      <th rowSpan={2} className="border px-2 py-1 align-middle text-center">Total IR</th>
                      <th rowSpan={2} className="border px-2 py-1 align-middle text-center">Total NMR</th>
                      <th rowSpan={2} className="border px-2 py-1 align-middle text-center">Total Labour</th>
                      <th rowSpan={2} className="border px-2 py-1 align-middle text-center">Per Day Avg (Total/{N})</th>
                    </tr>

                    <tr>
                      {matrix.days.flatMap((_, i) => [
                        <th key={`ir-${i}`} className="border px-2 py-1 text-center">IR</th>,
                        <th key={`nmr-${i}`} className="border px-2 py-1 text-center">NMR</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.length === 0 && (
                      <tr>
                        <td colSpan={4 + N * 2 + 4} className="border text-center py-6 text-muted-foreground">
                          No entries for this project in the selected range.
                        </td>
                      </tr>
                    )}
                    {matrix.rows.map((r, i) => (
                      <tr key={r.contractorId} className={i % 2 ? "bg-muted/20" : ""}>
                        <td className="border px-2 py-1 text-center">{i + 1}</td>
                        <td className="border px-2 py-1 text-center">{r.code}</td>
                        <td className="border px-2 py-1">{r.name}</td>
                        <td className="border px-2 py-1">{r.nature}</td>
                        {r.days.flatMap((d, j) => [
                          <td key={`ir-${j}`} className="border px-2 py-1 text-right tabular-nums">{fmt(d.ir)}</td>,
                          <td key={`nmr-${j}`} className="border px-2 py-1 text-right tabular-nums">{fmt(d.nmr)}</td>,
                        ])}
                        <td className="border px-2 py-1 text-right tabular-nums font-semibold">{fmt(r.totalIR)}</td>
                        <td className="border px-2 py-1 text-right tabular-nums font-semibold">{fmt(r.totalNMR)}</td>
                        <td className="border px-2 py-1 text-right tabular-nums font-semibold">{fmt(r.totalWeek)}</td>
                        <td className="border px-2 py-1 text-right tabular-nums font-semibold">{r.perWeek ? r.perWeek.toFixed(2) : ""}</td>
                      </tr>
                    ))}
                    {matrix.rows.length > 0 && (
                      <tr className="bg-muted font-semibold">
                        <td colSpan={4} className="border px-2 py-1 text-right">Totals</td>
                        {matrix.totals.days.flatMap((d, j) => [
                          <td key={`t-ir-${j}`} className="border px-2 py-1 text-right tabular-nums">{fmt(d.ir)}</td>,
                          <td key={`t-nmr-${j}`} className="border px-2 py-1 text-right tabular-nums">{fmt(d.nmr)}</td>,
                        ])}
                        <td className="border px-2 py-1 text-right tabular-nums">{fmt(matrix.totals.totalIR)}</td>
                        <td className="border px-2 py-1 text-right tabular-nums">{fmt(matrix.totals.totalNMR)}</td>
                        <td className="border px-2 py-1 text-right tabular-nums">{fmt(matrix.totals.totalWeek)}</td>
                        <td className="border px-2 py-1 text-right tabular-nums">{matrix.totals.perWeek ? matrix.totals.perWeek.toFixed(2) : ""}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
