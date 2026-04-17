import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
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
import {
  Users, ClipboardList, HardHat, CalendarIcon, TrendingUp, TrendingDown,
  AlertTriangle, Building2, Layers, Trophy, Activity, Briefcase,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  Legend, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
} from "recharts";
import {
  format, subDays, eachDayOfInterval, differenceInCalendarDays,
} from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
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

const FILTER_KEY = "dlax.dashboard.filters.v1";

type SavedFilters = {
  rangeDays: number;
  projectId: string;
  contractorId: string;
  departmentId: string;
};

function loadFilters(): SavedFilters {
  if (typeof window === "undefined") {
    return { rangeDays: 30, projectId: "all", contractorId: "all", departmentId: "all" };
  }
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) return { rangeDays: 30, projectId: "all", contractorId: "all", departmentId: "all", ...JSON.parse(raw) };
  } catch {}
  return { rangeDays: 30, projectId: "all", contractorId: "all", departmentId: "all" };
}

function DashboardContent() {
  const { user } = useAuth();
  const initial = loadFilters();

  const [rangeDays, setRangeDays] = useState<number>(initial.rangeDays);
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), initial.rangeDays - 1));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState(initial.projectId);
  const [contractorId, setContractorId] = useState(initial.contractorId);
  const [departmentId, setDepartmentId] = useState(initial.departmentId);

  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [prevRows, setPrevRows] = useState<any[]>([]);
  const [todayRows, setTodayRows] = useState<any[]>([]);
  const [yesterdayRows, setYesterdayRows] = useState<any[]>([]);

  // persist filters
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({ rangeDays, projectId, contractorId, departmentId }));
    } catch {}
  }, [rangeDays, projectId, contractorId, departmentId, user?.id]);

  useEffect(() => { loadMasters(); }, []);
  useEffect(() => { loadData(); }, [dateFrom, dateTo, projectId, contractorId, departmentId]);

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
    if (projectId !== "all") q = q.eq("project_id", projectId);
    if (contractorId !== "all") q = q.eq("contractor_id", contractorId);
    if (departmentId !== "all") q = q.eq("department_id", departmentId);
    return q;
  };

  const loadData = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const days = differenceInCalendarDays(dateTo, dateFrom) + 1;
    const prevTo = subDays(dateFrom, 1);
    const prevFrom = subDays(prevTo, days - 1);

    const sel = "entry_date, headcount, project_id, contractor_id, department_id, category_id";

    const [cur, prev, td, yd] = await Promise.all([
      applyFilters(supabase.from("daily_manpower").select(sel)
        .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("entry_date", format(dateTo, "yyyy-MM-dd"))),
      applyFilters(supabase.from("daily_manpower").select(sel)
        .gte("entry_date", format(prevFrom, "yyyy-MM-dd"))
        .lte("entry_date", format(prevTo, "yyyy-MM-dd"))),
      applyFilters(supabase.from("daily_manpower").select(sel).eq("entry_date", today)),
      applyFilters(supabase.from("daily_manpower").select(sel).eq("entry_date", yesterday)),
    ]);
    setRows(cur.data || []);
    setPrevRows(prev.data || []);
    setTodayRows(td.data || []);
    setYesterdayRows(yd.data || []);
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

  const projectsWithoutToday = useMemo(() => {
    const reportedToday = new Set(todayRows.map((r) => r.project_id));
    const activeIds = new Set(rows.map((r) => r.project_id));
    return Array.from(activeIds)
      .filter((id) => !reportedToday.has(id))
      .map((id) => projectMap.get(id))
      .filter(Boolean)
      .slice(0, 6);
  }, [todayRows, rows, projectMap]);

  const setRange = (days: number) => {
    setRangeDays(days);
    setDateFrom(subDays(new Date(), days - 1));
    setDateTo(new Date());
  };

  const resetFilters = () => {
    setRange(30);
    setProjectId("all");
    setContractorId("all");
    setDepartmentId("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Workforce overview — {format(dateFrom, "dd MMM yyyy")} to {format(dateTo, "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {[7, 14, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={rangeDays === d ? "default" : "ghost"} onClick={() => setRange(d)}>
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <DatePicker value={dateFrom} onChange={(d) => { setDateFrom(d); setRangeDays(0); }} label="From" />
            <DatePicker value={dateTo} onChange={(d) => { setDateTo(d); setRangeDays(0); }} label="To" />
            <div className="space-y-1">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{[p.code && `[${p.code}]`, p.name].filter(Boolean).join(" ")}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's snapshot */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Workers Today" value={stats.todayTotal} icon={Activity}
          delta={stats.dayChangePct} deltaLabel="vs yesterday" tone="primary"
        />
        <KpiCard
          title="Period Total" value={stats.total} icon={Users}
          delta={stats.periodChangePct} deltaLabel="vs prev period" tone="accent"
        />
        <KpiCard
          title="Avg Workers/Day" value={stats.avgPerDay} icon={TrendingUp} tone="chart-3"
        />
        <KpiCard
          title="Active Projects" value={stats.activeProjects} icon={Briefcase}
          subtitle={`${stats.activeContractors} contractors • ${stats.entries} entries`} tone="chart-4"
        />
      </div>

      {/* Alerts */}
      {projectsWithoutToday.length > 0 && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex-row items-center gap-2 pb-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">No entry today — {projectsWithoutToday.length} project(s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {projectsWithoutToday.map((p: any) => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {p.code ? `[${p.code}] ` : ""}{p.name}
                </Badge>
              ))}
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

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard title="Top Contractors" icon={HardHat} rows={topContractors} total={stats.total} />
        <Leaderboard title="Top Projects" icon={Briefcase} rows={topProjects} total={stats.total} />
      </div>

      {/* Breakdowns */}
      <Tabs defaultValue="department">
        <TabsList>
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

function KpiCard({
  title, value, icon: Icon, delta, deltaLabel, subtitle, tone = "primary",
}: {
  title: string; value: number; icon: any; delta?: number; deltaLabel?: string; subtitle?: string; tone?: string;
}) {
  const showDelta = typeof delta === "number" && isFinite(delta) && delta !== 0;
  const positive = (delta || 0) >= 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 text-${tone}`} />
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

function Leaderboard({ title, icon: Icon, rows, total }: { title: string; icon: any; rows: { id: string; name: string; total: number }[]; total: number }) {
  return (
    <Card>
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
                <div key={r.id}>
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
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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
