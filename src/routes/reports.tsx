import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Download, Users, CalendarDays, HardHat, TrendingUp } from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientOnly } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  component: () => (
    <AuthGuard>
      <ClientOnly fallback={<div className="p-8 text-center text-muted-foreground">Loading reports...</div>}>
        <ReportsPage />
      </ClientOnly>
    </AuthGuard>
  ),
});

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

function ReportsPage() {
  const [tab, setTab] = useState("daily");
  
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 6));
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
      let query = supabase.from("daily_manpower").select("*, projects(name, code, project_group), contractors(company_name), departments(name), worker_categories(name)");

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
    const headers = ["Date", "Project", "Contractor", "Department", "Category", "Headcount", "Remarks"];
    const rows = filtered.map((r) => [
      r.entry_date, getName(r.projects), getName(r.contractors), getName(r.departments), getName(r.worker_categories),
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">View and export workforce reports</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" />Export CSV
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="daily">Daily Summary</TabsTrigger>
          <TabsTrigger value="project">Project-wise</TabsTrigger>
          <TabsTrigger value="contractor">Contractor-wise</TabsTrigger>
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
            <div className="flex flex-wrap gap-3 items-end">
              <DatePicker value={dateFrom} onChange={setDateFrom} label="From" />
              <DatePicker value={dateTo} onChange={setDateTo} label="To" />
              <div className="space-y-1">
                <Label>Project Group</Label>
                <Select value={projectGroup} onValueChange={(v) => { setProjectGroup(v); setProjectId("all"); }}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {projectGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {visibleProjects.map((p) => <SelectItem key={p.id} value={p.id}>{[p.code && `[${p.code}]`, p.name, p.project_group && `— ${p.project_group}`].filter(Boolean).join(" ")}</SelectItem>)}
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
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Search</Label>
                <Input placeholder="Search remarks/names..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" />
              </div>
              <Button variant="outline" onClick={resetFilters}>Reset</Button>
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

        {/* Results */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Results ({filtered.length} entries)</CardTitle>
              <div className="flex gap-4 text-sm flex-wrap">
                <span>Workers: <strong>{stats.total}</strong></span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  )}
                  {!loading && filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.entry_date}</TableCell>
                      <TableCell>{getName(r.projects)}</TableCell>
                      <TableCell>{getName(r.contractors)}</TableCell>
                      <TableCell>{getName(r.departments)}</TableCell>
                      <TableCell>{getName(r.worker_categories)}</TableCell>
                      <TableCell className="text-right font-medium">{r.headcount}</TableCell>
                      <TableCell className="text-muted-foreground">{r.remarks || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No data found for selected filters</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
