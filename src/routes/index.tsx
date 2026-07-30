import { createFileRoute, Navigate } from "@tanstack/react-router";
import { usePermissions } from "@/hooks/use-permissions";
import { APP_SCREENS } from "@/lib/screens";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import {
  Users, ClipboardList, HardHat, CalendarIcon, TrendingUp, TrendingDown,
  AlertTriangle, Building2, Layers, Trophy, Activity, Briefcase, RefreshCw,
} from "lucide-react";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from "recharts";
import {
  format, subDays, eachDayOfInterval, differenceInCalendarDays,
} from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { canView, loading } = usePermissions();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (canView("dashboard")) return <DashboardContent />;
  const first = APP_SCREENS.find((s) => s.key !== "dashboard" && canView(s.key));
  return <Navigate to={(first?.path as any) || "/login"} />;
}

const PALETTE = [
  "oklch(0.55 0.18 250)",
  "oklch(0.65 0.18 30)",
  "oklch(0.6 0.18 150)",
  "oklch(0.6 0.18 320)",
  "oklch(0.65 0.18 90)",
  "oklch(0.55 0.16 200)",
  "oklch(0.6 0.16 350)",
  "oklch(0.6 0.18 60)",
];

function DatePicker({ value, onChange, label }: { value: Date; onChange: (d: Date) => void; label: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[170px] justify-start text-left font-normal")}>
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

function ProjectMultiSelect({
  projects,
  value,
  onChange,
}: {
  projects: any[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(value);
  const label =
    value.length === 0
      ? "All Projects"
      : value.length === 1
      ? (() => {
          const p = projects.find((x) => x.id === value[0]);
          return p ? [p.code && `[${p.code}]`, p.name].filter(Boolean).join(" ") : "1 project selected";
        })()
      : `${value.length} projects selected`;

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[220px] justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All Projects"
                onSelect={() => onChange([])}
              >
                <Checkbox checked={value.length === 0} className="mr-2" />
                <span className="font-medium">All Projects</span>
              </CommandItem>
              {projects.map((p) => {
                const lbl = [p.code && `[${p.code}]`, p.name].filter(Boolean).join(" ");
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.code ?? ""} ${p.name}`}
                    onSelect={() => toggle(p.id)}
                  >
                    <Checkbox checked={selectedSet.has(p.id)} className="mr-2" />
                    <span className="truncate">{lbl}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const FILTER_KEY = "dlax.dashboard.filters.v2";

type SavedFilters = {
  rangeDays: number;
  dateFrom: string | null;
  dateTo: string | null;
  projectIds: string[];
  contractorId: string;
  departmentId: string;
  approvalStatus: "all" | "draft" | "pending" | "approved";
};

const ISO = "yyyy-MM-dd";

/** Derive the [from, to] window for a preset range (days > 0), anchored on today. */
function windowForRange(days: number): { from: Date; to: Date } {
  const to = new Date();
  return { from: subDays(to, Math.max(1, days) - 1), to };
}

function parseISODate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function loadFilters(): SavedFilters {
  const base: SavedFilters = {
    rangeDays: 30,
    dateFrom: null,
    dateTo: null,
    projectIds: [],
    contractorId: "all",
    departmentId: "all",
    approvalStatus: "all",
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as any;
    // Migrate legacy `projectId: string` -> `projectIds: string[]`
    let projectIds: string[] = [];
    if (Array.isArray(parsed.projectIds)) projectIds = parsed.projectIds.filter((x: any) => typeof x === "string" && x && x !== "all");
    else if (typeof parsed.projectId === "string" && parsed.projectId && parsed.projectId !== "all") projectIds = [parsed.projectId];
    const as = parsed.approvalStatus;
    return {
      rangeDays: typeof parsed.rangeDays === "number" ? parsed.rangeDays : 30,
      dateFrom: typeof parsed.dateFrom === "string" ? parsed.dateFrom : null,
      dateTo: typeof parsed.dateTo === "string" ? parsed.dateTo : null,
      projectIds,
      contractorId: parsed.contractorId || "all",
      departmentId: parsed.departmentId || "all",
      approvalStatus: as === "pending" || as === "approved" || as === "draft" ? as : "all",
    };
  } catch {}
  return base;
}

/** Resolve the initial window: preset ranges re-anchor to today, custom ranges restore as saved. */
function initialWindow(initial: SavedFilters): { from: Date; to: Date } {
  if (initial.rangeDays > 0) return windowForRange(initial.rangeDays);
  const from = parseISODate(initial.dateFrom);
  const to = parseISODate(initial.dateTo);
  if (from && to) return { from, to };
  return windowForRange(30);
}

function DashboardContent() {
  const { user } = useAuth();
  const [initial] = useState<SavedFilters>(() => loadFilters());
  const [initialRange] = useState(() => initialWindow(initial));

  const [rangeDays, setRangeDays] = useState<number>(initial.rangeDays);
  const [dateFrom, setDateFrom] = useState<Date>(initialRange.from);
  const [dateTo, setDateTo] = useState<Date>(initialRange.to);
  const [projectIds, setProjectIds] = useState<string[]>(initial.projectIds);
  const [contractorId, setContractorId] = useState(initial.contractorId);
  const [departmentId, setDepartmentId] = useState(initial.departmentId);
  const [approvalStatus, setApprovalStatus] = useState<"all" | "draft" | "pending" | "approved">(initial.approvalStatus);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusProjectsOpen, setStatusProjectsOpen] = useState(false);
  const [statusProjectSearch, setStatusProjectSearch] = useState("");

  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [prevRows, setPrevRows] = useState<any[]>([]);
  const [todayRows, setTodayRows] = useState<any[]>([]);
  const [yesterdayRows, setYesterdayRows] = useState<any[]>([]);
  const [statusRows, setStatusRows] = useState<any[]>([]);
  const [drill, setDrill] = useState<{ type: "project" | "contractor"; id: string; label: string } | null>(null);
  const projectIdsKey = projectIds.join(",");
  const fromKey = format(dateFrom, ISO);
  const toKey = format(dateTo, ISO);
  const loadSeq = useRef(0);

  // persist filters
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        FILTER_KEY,
        JSON.stringify({ rangeDays, dateFrom: fromKey, dateTo: toKey, projectIds, contractorId, departmentId, approvalStatus }),
      );
    } catch {}
  }, [rangeDays, fromKey, toKey, projectIdsKey, contractorId, departmentId, approvalStatus, user?.id]);

  useEffect(() => { loadMasters(); }, []);
  useEffect(() => { loadData(); }, [fromKey, toKey, projectIdsKey, contractorId, departmentId, approvalStatus, refreshKey]);


  useEffect(() => {
    const refresh = () => { loadMasters(); loadData(); };
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, projectIdsKey, contractorId, departmentId]);


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

  const applyFilters = (q: any) => {
    q = applyBaseFilters(q);
    if (approvalStatus === "approved") q = q.eq("status", "approved");
    else if (approvalStatus === "pending") q = q.in("status", ["pending_l1", "pending_l2"]);
    else if (approvalStatus === "draft") q = q.eq("status", "draft");
    return q;
  };

  const applyBaseFilters = (q: any) => {
    if (projectIds.length > 0) q = q.in("project_id", projectIds);
    if (contractorId !== "all") q = q.eq("contractor_id", contractorId);
    if (departmentId !== "all") q = q.eq("department_id", departmentId);
    return q;
  };


  const loadData = async () => {
    const seq = ++loadSeq.current;
    setIsLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const days = differenceInCalendarDays(dateTo, dateFrom) + 1;
    const prevTo = subDays(dateFrom, 1);
    const prevFrom = subDays(prevTo, days - 1);

    const sel = "entry_date, headcount, project_id, contractor_id, department_id, category_id";

    try {
      const [cur, prev, td, yd, st] = await Promise.all([
        applyFilters(supabase.from("daily_manpower").select(sel)
          .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
          .lte("entry_date", format(dateTo, "yyyy-MM-dd"))),
        applyFilters(supabase.from("daily_manpower").select(sel)
          .gte("entry_date", format(prevFrom, "yyyy-MM-dd"))
          .lte("entry_date", format(prevTo, "yyyy-MM-dd"))),
        applyFilters(supabase.from("daily_manpower").select(sel).eq("entry_date", today)),
        applyFilters(supabase.from("daily_manpower").select(sel).eq("entry_date", yesterday)),
        applyBaseFilters(supabase.from("daily_manpower").select("headcount, project_id, status")
          .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
          .lte("entry_date", format(dateTo, "yyyy-MM-dd"))),
      ]);
      // Ignore results from a superseded load (e.g. focus refresh raced a click).
      if (seq !== loadSeq.current) return;
      setRows(cur.data || []);
      setPrevRows(prev.data || []);
      setTodayRows(td.data || []);
      setYesterdayRows(yd.data || []);
      setStatusRows(st.data || []);
      setLastUpdated(new Date());
    } finally {
      if (seq === loadSeq.current) setIsLoading(false);
    }
  };




  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const contractorMap = useMemo(() => new Map(contractors.map((c) => [c.id, c])), [contractors]);
  const departmentMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + (r.headcount || 0), 0);
    const prevTotal = prevRows.reduce((s, r) => s + (r.headcount || 0), 0);
    const uniqueDays = new Set(rows.map((r) => r.entry_date)).size;
    const avgPerDay = uniqueDays ? Math.round(total / uniqueDays) : 0;
    const todayTotal = todayRows.reduce((s, r) => s + (r.headcount || 0), 0);
    const yTotal = yesterdayRows.reduce((s, r) => s + (r.headcount || 0), 0);
    const dayChangePct = yTotal ? ((todayTotal - yTotal) / yTotal) * 100 : 0;
    const periodChangePct = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : 0;
    return {
      total, prevTotal, avgPerDay,
      activeContractors: new Set(rows.map((r) => r.contractor_id)).size,
      activeProjects: new Set(rows.map((r) => r.project_id)).size,
      entries: rows.length,
      todayTotal, yTotal, dayChangePct, periodChangePct,
    };
  }, [rows, prevRows, todayRows, yesterdayRows]);

  const trendData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
    const totalDays = days.length;
    return days.map((d, i) => {
      const key = format(d, "yyyy-MM-dd");
      const prevDate = format(subDays(d, totalDays), "yyyy-MM-dd");
      return {
        date: format(d, "dd MMM"),
        current: rows.filter((r) => r.entry_date === key).reduce((s, r) => s + (r.headcount || 0), 0),
        previous: prevRows.filter((r) => r.entry_date === prevDate).reduce((s, r) => s + (r.headcount || 0), 0),
      };
    });
  }, [rows, prevRows, dateFrom, dateTo]);

  const topContractors = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.contractor_id, (m.get(r.contractor_id) || 0) + (r.headcount || 0)));
    return Array.from(m.entries())
      .map(([id, total]) => ({ id, name: contractorMap.get(id)?.company_name || "—", total }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
  }, [rows, contractorMap]);

  const topProjects = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.project_id, (m.get(r.project_id) || 0) + (r.headcount || 0)));
    return Array.from(m.entries())
      .map(([id, total]) => {
        const p = projectMap.get(id);
        return { id, name: p ? [p.code && `[${p.code}]`, p.name].filter(Boolean).join(" ") : "—", total };
      })
      .sort((a, b) => b.total - a.total).slice(0, 5);
  }, [rows, projectMap]);

  const deptBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.department_id, (m.get(r.department_id) || 0) + (r.headcount || 0)));
    return Array.from(m.entries())
      .map(([id, value]) => ({ id, name: departmentMap.get(id)?.name || "—", value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, departmentMap]);

  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.category_id, (m.get(r.category_id) || 0) + (r.headcount || 0)));
    return Array.from(m.entries())
      .map(([id, value]) => ({ id, name: categoryMap.get(id)?.name || "—", value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, categoryMap]);

  const groupRollup = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const p = projectMap.get(r.project_id);
      const key = p?.project_group || "Unassigned";
      m.set(key, (m.get(key) || 0) + (r.headcount || 0));
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, projectMap]);

  const divisionRollup = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const p = projectMap.get(r.project_id);
      const key = p?.division || "Unassigned";
      m.set(key, (m.get(key) || 0) + (r.headcount || 0));
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows, projectMap]);

  const todayLabel = format(new Date(), "dd-MMM-yyyy");

  const statusBreakdown = useMemo(() => {
    const buckets: { key: "draft" | "pending" | "approved"; label: string; tint: string }[] = [
      { key: "draft", label: "Draft", tint: "stat-tint-amber" },
      { key: "pending", label: "Pending", tint: "stat-tint-blue" },
      { key: "approved", label: "Approved", tint: "stat-tint-green" },
    ];
    const bucketOf = (s: string) =>
      s === "approved" ? "approved" : s === "pending_l1" || s === "pending_l2" ? "pending" : s === "draft" ? "draft" : null;

    return buckets.map((b) => {
      const rowsOf = statusRows.filter((r) => bucketOf(String(r.status)) === b.key);
      const total = rowsOf.reduce((s, r) => s + (r.headcount || 0), 0);
      const ids = Array.from(new Set(rowsOf.map((r) => r.project_id)));
      const projectsOf = ids
        .map((id) => {
          const p = projectMap.get(id);
          return { id, label: p ? `${p.code ? `[${p.code}] ` : ""}${p.name}` : "—" };
        })
        .sort((a, b2) => a.label.localeCompare(b2.label));
      return { ...b, total, entries: rowsOf.length, projects: projectsOf };
    });
  }, [statusRows, projectMap]);

  const projectsWithoutToday = useMemo(() => {
    const reportedToday = new Set(todayRows.map((r) => r.project_id));
    const selected = new Set(projectIds);
    const candidates = projectIds.length > 0
      ? projects.filter((p) => selected.has(p.id))
      : projects;
    return candidates
      .filter((p: any) => p && !reportedToday.has(p.id))
      .filter((p: any) => !p.status || String(p.status).toLowerCase() === "active");
  }, [todayRows, projects, projectIdsKey]);


  const setRange = (days: number) => {
    const { from, to } = windowForRange(days);
    setRangeDays(days);
    setDateFrom(from);
    setDateTo(to);
  };

  /** Force a reload even when no filter value changed. */
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const resetFilters = () => {
    setRange(30);
    setProjectIds([]);
    setContractorId("all");
    setDepartmentId("all");
    setApprovalStatus("all");
    triggerRefresh();
    toast.success("Filters reset — data reloaded");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Workforce overview — ${format(dateFrom, "dd MMM yyyy")} to ${format(dateTo, "dd MMM yyyy")}`}
        actions={
          <div className="flex gap-2 items-center">
            {lastUpdated && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updated {format(lastUpdated, "HH:mm:ss")}
              </span>
            )}
            <Button size="sm" variant="outline" disabled={isLoading} onClick={() => { loadMasters(); triggerRefresh(); }}>
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} /> Refresh
            </Button>


            <div className="flex gap-1 rounded-lg border bg-card p-1">
              <Button size="sm" variant={rangeDays === 1 ? "default" : "ghost"} onClick={() => setRange(1)}>
                Today
              </Button>
              {[7, 14, 30, 90].map((d) => (
                <Button key={d} size="sm" variant={rangeDays === d ? "default" : "ghost"} onClick={() => setRange(d)}>
                  {d}d
                </Button>
              ))}
            </div>
          </div>
        }

      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <DatePicker value={dateFrom} onChange={(d) => { setDateFrom(d); setRangeDays(0); }} label="From" />
            <DatePicker value={dateTo} onChange={(d) => { setDateTo(d); setRangeDays(0); }} label="To" />
            <div className="space-y-1">
              <Label>Project</Label>
              <ProjectMultiSelect
                projects={projects}
                value={projectIds}
                onChange={setProjectIds}
              />
            </div>
            <div className="space-y-1">
              <Label>Contractor</Label>
              <Select value={contractorId} onValueChange={setContractorId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contractors</SelectItem>
                  {contractors.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={approvalStatus} onValueChange={(v) => setApprovalStatus(v as any)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Workers Today" value={stats.todayTotal} icon={Activity}
          delta={stats.dayChangePct} deltaLabel="vs yesterday" tint="stat-tint-blue"
        />
        <KpiCard
          title="Period Total" value={stats.total} icon={Users}
          delta={stats.periodChangePct} deltaLabel="vs prev period" tint="stat-tint-green"
        />
        <KpiCard
          title="Avg Workers/Day" value={stats.avgPerDay} icon={TrendingUp} tint="stat-tint-amber"
        />
        <KpiCard
          title="Active Projects" value={stats.activeProjects} icon={Briefcase}
          subtitle={`${stats.activeContractors} contractors • ${stats.entries} entries`} tint="stat-tint-purple"
        />
      </div>

      {/* Approval status breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Approval Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {statusBreakdown.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setApprovalStatus(approvalStatus === b.key ? "all" : b.key)}
                className={`rounded-lg border p-3 text-left focus:outline-none transition-shadow ${b.tint} ${approvalStatus === b.key ? "ring-2 ring-ring" : "hover:shadow-sm"}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{b.label}</span>
                  <span className="text-2xl font-semibold tabular-nums">{b.total.toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.entries} entr{b.entries === 1 ? "y" : "ies"} • {b.projects.length} project(s)
                </div>
              </button>
            ))}
          </div>

          {(() => {
            const sel = statusBreakdown.find((b) => b.key === approvalStatus);
            if (!sel) {
              return (
                <p className="text-xs text-muted-foreground">
                  Select Draft, Pending or Approved to see the projects in that status.
                </p>
              );
            }
            const MAX_INLINE = 12;
            const shown = sel.projects.slice(0, MAX_INLINE);
            return (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {sel.label} projects ({sel.projects.length})
                  </span>
                  {sel.projects.length > MAX_INLINE && (
                    <Button variant="outline" size="sm" onClick={() => { setStatusProjectSearch(""); setStatusProjectsOpen(true); }}>
                      View all {sel.projects.length}
                    </Button>
                  )}
                </div>
                <div className="max-h-[140px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-1.5">
                    {sel.projects.length === 0 && <span className="text-xs text-muted-foreground">No data</span>}
                    {shown.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDrill({ type: "project", id: p.id, label: p.label })}
                        className="focus:outline-none focus:ring-2 focus:ring-ring rounded-md"
                      >
                        <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors">
                          {p.label}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Dialog open={statusProjectsOpen} onOpenChange={setStatusProjectsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {statusBreakdown.find((b) => b.key === approvalStatus)?.label ?? "Status"} projects
            </DialogTitle>
            <DialogDescription>Click a project to drill down.</DialogDescription>
          </DialogHeader>
          <input
            value={statusProjectSearch}
            onChange={(e) => setStatusProjectSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {(statusBreakdown.find((b) => b.key === approvalStatus)?.projects ?? [])
              .filter((p) => p.label.toLowerCase().includes(statusProjectSearch.trim().toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setStatusProjectsOpen(false); setDrill({ type: "project", id: p.id, label: p.label }); }}
                  className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {p.label}
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>



      {/* Top summaries — directly after KPI boxes */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Leaderboard title="Top Contractors" icon={HardHat} rows={topContractors} total={stats.total}
          tint="stat-tint-blue"
          onSelect={(r) => setDrill({ type: "contractor", id: r.id, label: r.name })} />
        <TopList title="Top Departments" icon={Layers} data={deptBreakdown.slice(0, 5)} total={stats.total} tint="stat-tint-green" />
        <TopList title="Top Categories" icon={ClipboardList} data={categoryBreakdown.slice(0, 5)} total={stats.total} tint="stat-tint-amber" />
        <TopList title="Top Project Groups" icon={Building2} data={groupRollup.slice(0, 5)} total={stats.total} tint="stat-tint-purple" />
        <TopList title="Top Divisions" icon={Building2} data={divisionRollup.slice(0, 5)} total={stats.total} tint="stat-tint-teal" />
        <Leaderboard title="Top Projects" icon={Briefcase} rows={topProjects} total={stats.total}
          tint="stat-tint-rose"
          onSelect={(r) => setDrill({ type: "project", id: r.id, label: r.name })} />
      </div>

      {/* Alerts */}
      {projectsWithoutToday.length > 0 && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex-row items-center gap-2 pb-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">No entry on {todayLabel} — {projectsWithoutToday.length} project(s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {projectsWithoutToday.map((p: any) => {
                const label = `${p.code ? `[${p.code}] ` : ""}${p.name}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDrill({ type: "project", id: p.id, label })}
                    className="focus:outline-none focus:ring-2 focus:ring-ring rounded-md"
                  >
                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted transition-colors">
                      {label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend chart */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">Worker Trend — Current vs Previous Period</CardTitle>
          <span className="text-xs text-muted-foreground">Total: {stats.total.toLocaleString()} (prev: {stats.prevTotal.toLocaleString()})</span>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <RTooltip />
                <Legend />
                <Line type="monotone" dataKey="previous" name="Previous period" stroke="oklch(0.7 0.02 250)" strokeDasharray="4 4" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="current" name="Current period" stroke="oklch(0.55 0.18 250)" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DrillDialog
        drill={drill}
        onClose={() => setDrill(null)}
        rows={rows}
        dateFrom={dateFrom}
        dateTo={dateTo}
        projectMap={projectMap}
        contractorMap={contractorMap}
        departmentMap={departmentMap}
        categoryMap={categoryMap}
      />

      {/* Detailed Breakdowns */}
      <Tabs defaultValue="department">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="department"><Layers className="h-4 w-4 mr-1.5" />Department</TabsTrigger>
          <TabsTrigger value="category"><ClipboardList className="h-4 w-4 mr-1.5" />Category</TabsTrigger>
          <TabsTrigger value="group"><Building2 className="h-4 w-4 mr-1.5" />Project Group</TabsTrigger>
          <TabsTrigger value="division"><Building2 className="h-4 w-4 mr-1.5" />Division</TabsTrigger>
        </TabsList>
        <TabsContent value="department"><BreakdownCard data={deptBreakdown} title="Workforce by Department" /></TabsContent>
        <TabsContent value="category"><BreakdownCard data={categoryBreakdown} title="Workforce by Category" /></TabsContent>
        <TabsContent value="group"><BreakdownCard data={groupRollup} title="Workforce by Project Group" /></TabsContent>
        <TabsContent value="division"><BreakdownCard data={divisionRollup} title="Workforce by Division" /></TabsContent>
      </Tabs>
    </div>
  );
}

function TopList({ title, icon: Icon, data, total, tint }: { title: string; icon: any; data: { name: string; value: number }[]; total: number; tint?: string }) {
  return (
    <Card className={tint}>
      <CardHeader className="flex-row items-center gap-2 pb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <CardTitle className="text-base flex items-center gap-2"><Icon className="h-4 w-4" />{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data in selected period.</p>
        ) : (
          <div className="space-y-3">
            {data.map((r, i) => {
              const pct = total ? (r.value / total) * 100 : 0;
              return (
                <div key={r.name + i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                      <span className="truncate font-medium">{r.name}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums whitespace-nowrap">
                      {r.value.toLocaleString()} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  title, value, icon: Icon, delta, deltaLabel, subtitle, tint,
}: {
  title: string; value: number; icon: any; delta?: number; deltaLabel?: string; subtitle?: string; tint?: string;
}) {
  const showDelta = typeof delta === "number" && isFinite(delta) && delta !== 0;
  const positive = (delta || 0) >= 0;
  return (
    <Card className={tint}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-foreground/70" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        {showDelta ? (
          <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", positive ? "text-emerald-600" : "text-rose-600")}>
            {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(delta!).toFixed(1)}% <span className="text-muted-foreground font-normal">{deltaLabel}</span>
          </div>
        ) : subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Leaderboard({ title, icon: Icon, rows, total, onSelect, tint }: { title: string; icon: any; rows: { id: string; name: string; total: number }[]; total: number; onSelect?: (r: { id: string; name: string; total: number }) => void; tint?: string }) {
  return (
    <Card className={tint}>
      <CardHeader className="flex-row items-center gap-2 pb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <CardTitle className="text-base flex items-center gap-2"><Icon className="h-4 w-4" />{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data in selected period.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => {
              const pct = total ? (r.total / total) * 100 : 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect?.(r)}
                  className="w-full text-left rounded-md p-1.5 -m-1.5 hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 truncate">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                      <span className="truncate font-medium">{r.name}</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums whitespace-nowrap">
                      {r.total.toLocaleString()} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DrillDialog({
  drill, onClose, rows, dateFrom, dateTo,
  projectMap, contractorMap, departmentMap, categoryMap,
}: {
  drill: { type: "project" | "contractor"; id: string; label: string } | null;
  onClose: () => void;
  rows: any[];
  dateFrom: Date;
  dateTo: Date;
  projectMap: Map<string, any>;
  contractorMap: Map<string, any>;
  departmentMap: Map<string, any>;
  categoryMap: Map<string, any>;
}) {
  const filtered = useMemo(() => {
    if (!drill) return [];
    const key = drill.type === "project" ? "project_id" : "contractor_id";
    return rows.filter((r) => r[key] === drill.id);
  }, [drill, rows]);

  const total = filtered.reduce((s, r) => s + (r.headcount || 0), 0);

  const trend = useMemo(() => {
    if (!drill) return [];
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
    return days.map((d) => {
      const k = format(d, "yyyy-MM-dd");
      return {
        date: format(d, "dd MMM"),
        workers: filtered.filter((r) => r.entry_date === k).reduce((s, r) => s + (r.headcount || 0), 0),
      };
    });
  }, [filtered, drill, dateFrom, dateTo]);

  const peak = trend.reduce((m, p) => Math.max(m, p.workers), 0);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    [filtered]
  );

  return (
    <Dialog open={!!drill} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {drill?.type === "project" ? <Briefcase className="h-5 w-5" /> : <HardHat className="h-5 w-5" />}
            {drill?.label}
          </DialogTitle>
          <DialogDescription>
            {format(dateFrom, "dd MMM yyyy")} – {format(dateTo, "dd MMM yyyy")} · {filtered.length} entries · {total.toLocaleString()} workers · peak {peak.toLocaleString()}/day
          </DialogDescription>
        </DialogHeader>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No entries in this period.</p>
        ) : (
          <div className="space-y-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="drillFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RTooltip />
                  <Area type="monotone" dataKey="workers" stroke="oklch(0.55 0.18 250)" strokeWidth={2} fill="url(#drillFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="border rounded-md max-h-[340px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>{drill?.type === "project" ? "Contractor" : "Project"}</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Workers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => {
                    const other = drill?.type === "project"
                      ? contractorMap.get(r.contractor_id)?.company_name
                      : (() => { const p = projectMap.get(r.project_id); return p ? [p.code && `[${p.code}]`, p.name].filter(Boolean).join(" ") : "—"; })();
                    return (
                      <TableRow key={r.id ?? `${r.entry_date}-${r.contractor_id}-${r.department_id}-${r.category_id}`}>
                        <TableCell className="font-mono text-xs">{format(new Date(r.entry_date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-medium">{other || "—"}</TableCell>
                        <TableCell>{departmentMap.get(r.department_id)?.name || "—"}</TableCell>
                        <TableCell>{categoryMap.get(r.category_id)?.name || "—"}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{(r.headcount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BreakdownCard({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No data in selected period.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                {data.length <= 8 ? (
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={2}>
                      {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <RTooltip />
                    <Legend />
                  </PieChart>
                ) : (
                  <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" className="text-xs" width={120} />
                    <RTooltip />
                    <Bar dataKey="value" fill="oklch(0.55 0.18 250)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Workers</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.name}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{d.value.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{total ? ((d.value / total) * 100).toFixed(1) : "0.0"}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
