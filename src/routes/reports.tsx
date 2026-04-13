import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Download, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/reports")({
  component: () => <AuthGuard><ReportsPage /></AuthGuard>,
});

function ReportsPage() {
  const [tab, setTab] = useState("daily");
  const [date, setDate] = useState<Date>(new Date());
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("all");
  const [contractorId, setContractorId] = useState("all");
  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    loadReport();
  }, [tab, date, dateFrom, dateTo, projectId, contractorId]);

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
    let query = supabase.from("daily_manpower").select("*, projects(name), contractors(company_name), departments(name), worker_categories(name)");

    if (tab === "daily") {
      query = query.eq("entry_date", format(date, "yyyy-MM-dd"));
    } else {
      query = query.gte("entry_date", format(dateFrom, "yyyy-MM-dd")).lte("entry_date", format(dateTo, "yyyy-MM-dd"));
    }

    if (projectId !== "all") query = query.eq("project_id", projectId);
    if (tab === "contractor" && contractorId !== "all") query = query.eq("contractor_id", contractorId);

    const { data: result } = await query.order("entry_date", { ascending: false });
    setData(result || []);
  };

  const getName = (obj: any) => obj?.name || obj?.company_name || "—";

  const totalHeadcount = data.reduce((s, r) => s + (r.headcount || 0), 0);
  const totalHours = data.reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);

  const exportCsv = () => {
    const headers = ["Date", "Project", "Contractor", "Department", "Category", "Headcount", "Hours", "OT Hours", "Remarks"];
    const rows = data.map((r) => [
      r.entry_date, getName(r.projects), getName(r.contractors), getName(r.departments), getName(r.worker_categories),
      r.headcount, r.hours_worked, r.overtime_hours, r.remarks || ""
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

  const DatePicker = ({ value, onChange, label }: { value: Date; onChange: (d: Date) => void; label: string }) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[180px] justify-start text-left")}>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-muted-foreground">View and export workforce reports</p></div>
        <Button variant="outline" onClick={exportCsv} disabled={data.length === 0}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="daily">Daily Summary</TabsTrigger>
          <TabsTrigger value="project">Project-wise</TabsTrigger>
          <TabsTrigger value="contractor">Contractor-wise</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap gap-4 items-end mt-4">
          {tab === "daily" ? (
            <DatePicker value={date} onChange={setDate} label="Date" />
          ) : (
            <>
              <DatePicker value={dateFrom} onChange={setDateFrom} label="From" />
              <DatePicker value={dateTo} onChange={setDateTo} label="To" />
            </>
          )}
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
          {tab === "contractor" && (
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
          )}
        </div>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Results ({data.length} entries)</CardTitle>
              <div className="flex gap-4 text-sm">
                <span>Total Workers: <strong>{totalHeadcount}</strong></span>
                <span>Total Hours: <strong>{totalHours.toFixed(1)}</strong></span>
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
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.entry_date}</TableCell>
                      <TableCell>{getName(r.projects)}</TableCell>
                      <TableCell>{getName(r.contractors)}</TableCell>
                      <TableCell>{getName(r.departments)}</TableCell>
                      <TableCell>{getName(r.worker_categories)}</TableCell>
                      <TableCell className="text-right font-medium">{r.headcount}</TableCell>
                      <TableCell className="text-right">{r.hours_worked}</TableCell>
                      <TableCell className="text-right">{r.overtime_hours}</TableCell>
                      <TableCell className="text-muted-foreground">{r.remarks || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {data.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No data found for selected filters</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
