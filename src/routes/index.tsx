import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, ClipboardList, HardHat, CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
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

function DashboardContent() {
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 29));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("all");
  const [contractorId, setContractorId] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");

  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo, projectId, contractorId, departmentId]);

  const loadMasters = async () => {
    const [p, c, d] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("contractors").select("*").order("company_name"),
      supabase.from("departments").select("*").order("name"),
    ]);
    setProjects(p.data || []);
    setContractors(c.data || []);
    setDepartments(d.data || []);
  };

  const loadData = async () => {
    let q = supabase
      .from("daily_manpower")
      .select("entry_date, headcount, project_id, contractor_id, department_id")
      .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
      .lte("entry_date", format(dateTo, "yyyy-MM-dd"));
    if (projectId !== "all") q = q.eq("project_id", projectId);
    if (contractorId !== "all") q = q.eq("contractor_id", contractorId);
    if (departmentId !== "all") q = q.eq("department_id", departmentId);
    const { data } = await q;
    setRows(data || []);
  };

  const stats = useMemo(() => {
    const totalWorkers = rows.reduce((s, r) => s + (r.headcount || 0), 0);
    const uniqueProjects = new Set(rows.map((r) => r.project_id)).size;
    const uniqueContractors = new Set(rows.map((r) => r.contractor_id)).size;
    const uniqueDays = new Set(rows.map((r) => r.entry_date)).size;
    const avgPerDay = uniqueDays ? Math.round(totalWorkers / uniqueDays) : 0;
    return {
      totalWorkers,
      activeProjects: uniqueProjects,
      activeContractors: uniqueContractors,
      avgPerDay,
      totalEntries: rows.length,
    };
  }, [rows]);

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return {
        date: format(d, "dd MMM"),
        workers: rows.filter((r) => r.entry_date === key).reduce((s, r) => s + (r.headcount || 0), 0),
      };
    });
  }, [rows, dateFrom, dateTo]);

  const cards = [
    { title: "Total Workers", value: stats.totalWorkers, icon: Users, color: "text-primary" },
    { title: "Avg Workers/Day", value: stats.avgPerDay, icon: Users, color: "text-accent" },
    { title: "Active Contractors", value: stats.activeContractors, icon: HardHat, color: "text-chart-3" },
    { title: "Total Entries", value: stats.totalEntries, icon: ClipboardList, color: "text-chart-4" },
  ];

  const resetFilters = () => {
    setDateFrom(subDays(new Date(), 29));
    setDateTo(new Date());
    setProjectId("all");
    setContractorId("all");
    setDepartmentId("all");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Workforce overview — {format(dateFrom, "dd MMM yyyy")} to {format(dateTo, "dd MMM yyyy")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <DatePicker value={dateFrom} onChange={setDateFrom} label="From" />
            <DatePicker value={dateTo} onChange={setDateTo} label="To" />
            <div className="space-y-1">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="workers" fill="oklch(0.45 0.18 250)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
