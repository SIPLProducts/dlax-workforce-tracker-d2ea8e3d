import { ScreenGuard } from "@/components/ScreenGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Pencil, Trash2, CalendarIcon, Users, HardHat, ClipboardList, Download, Upload, FileDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/PageHeader";
import { ProjectCombobox, type ProjectOption } from "@/components/ProjectCombobox";
import { useHighlightRow } from "@/hooks/use-highlight-row";

const LS_PROJECT_KEY = "masters_contractors_project_id";

export const Route = createFileRoute("/masters/contractors")({
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search.project === "string" ? search.project : undefined,
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  component: () => <ScreenGuard screen="masters_contractors"><ContractorsPage /></ScreenGuard>,
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

function ContractorsPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ contractor_code: "", company_name: "", contact_person: "", phone: "", license_number: "", contact_number: "", work_place: "", nature_of_work: "", contract_type: "item_rate" as "item_rate" | "nmr" });
  const [search, setSearch] = useState("");

  // Dashboard state
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 29));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [contractorId, setContractorId] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const { canEdit } = usePermissions();
  const requireEdit = () => {
    if (!canEdit("masters_contractors")) {
      toast.error("You are in View mode, not in Edit mode.");
      return false;
    }
    return true;
  };

  const routeSearch = Route.useSearch();

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (projectId) load(); else setItems([]); }, [projectId]);
  useEffect(() => { if (projectId) loadManpower(); }, [dateFrom, dateTo, contractorId, projectId]);

  // Honor ?project= deep link from global search
  useEffect(() => {
    if (routeSearch.project && projects.some((p) => p.id === routeSearch.project)) {
      setProjectId(routeSearch.project);
    }
  }, [routeSearch.project, projects]);

  useHighlightRow(items);

  const loadProjects = async () => {
    const { data } = await supabase.from("projects").select("id,name,code").order("name");
    const list = (data || []) as ProjectOption[];
    setProjects(list);
    if (routeSearch.project && list.some((p) => p.id === routeSearch.project)) {
      setProjectId(routeSearch.project);
      return;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_PROJECT_KEY) : null;
    if (stored && list.some((p) => p.id === stored)) setProjectId(stored);
    else if (list.length === 1) setProjectId(list[0].id);
  };

  useEffect(() => {
    if (projectId && typeof window !== "undefined") localStorage.setItem(LS_PROJECT_KEY, projectId);
  }, [projectId]);

  const load = async () => {
    const { data } = await supabase
      .from("project_contractors")
      .select("contractor:contractors(*)")
      .eq("project_id", projectId);
    const rows = (data || []).map((r: any) => r.contractor).filter(Boolean);
    rows.sort((a: any, b: any) => (a.company_name || "").localeCompare(b.company_name || ""));
    setItems(rows);
  };

  const loadManpower = async () => {
    let q = supabase
      .from("daily_manpower")
      .select("entry_date, headcount, contractor_id")
      .eq("project_id", projectId)
      .gte("entry_date", format(dateFrom, "yyyy-MM-dd"))
      .lte("entry_date", format(dateTo, "yyyy-MM-dd"));
    if (contractorId !== "all") q = q.eq("contractor_id", contractorId);
    const { data } = await q;
    setRows(data || []);
  };

  const stats = useMemo(() => {
    const totalWorkers = rows.reduce((s, r) => s + (r.headcount || 0), 0);
    const uniqueContractors = new Set(rows.map((r) => r.contractor_id)).size;
    const uniqueDays = new Set(rows.map((r) => r.entry_date)).size;
    const avgPerDay = uniqueDays ? Math.round(totalWorkers / uniqueDays) : 0;
    return { totalWorkers, activeContractors: uniqueContractors, avgPerDay, totalEntries: rows.length };
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

  const topContractors = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.contractor_id, (map.get(r.contractor_id) || 0) + (r.headcount || 0)));
    return Array.from(map.entries())
      .map(([id, total]) => ({ name: items.find((c) => c.id === id)?.company_name || "—", total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [rows, items]);

  const contractorsByNature = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((c) => {
      const key = (c.nature_of_work || "").trim() || "Unspecified";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const cards = [
    { title: "Total Contractors", value: items.length, icon: HardHat, color: "text-primary" },
    { title: "Nature of Work Types", value: contractorsByNature.length, icon: ClipboardList, color: "text-accent" },
    { title: "Total Workers (period)", value: stats.totalWorkers, icon: Users, color: "text-chart-3" },
    { title: "Avg Workers/Day", value: stats.avgPerDay, icon: Users, color: "text-chart-4" },
  ];

  const resetFilters = () => {
    setDateFrom(subDays(new Date(), 29));
    setDateTo(new Date());
    setContractorId("all");
  };

  const handleSave = async () => {
    if (!requireEdit()) return;
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    if (form.contact_number && !/^\d{10}$/.test(form.contact_number)) { toast.error("Contact Number must be exactly 10 digits"); return; }
    if (!editing && !projectId) { toast.error("Select a project first"); return; }
    try {
      if (editing) {
        const { error } = await supabase.from("contractors").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const code = (form.contractor_code || "").trim();
        const name = (form.company_name || "").trim();
        let contractorId: string | null = null;

        // Identity key = SC Code. Only look up an existing contractor by code.
        // Same-named contractors with different codes must remain distinct.
        if (code) {
          const { data: existingByCode } = await supabase
            .from("contractors")
            .select("id")
            .ilike("contractor_code", code)
            .limit(1)
            .maybeSingle();
          if (existingByCode) contractorId = (existingByCode as any).id;
        }

        // If found by code, check if already assigned to this project
        if (contractorId) {
          const { data: existingMap } = await supabase
            .from("project_contractors")
            .select("id")
            .eq("project_id", projectId)
            .eq("contractor_id", contractorId)
            .maybeSingle();
          if (existingMap) {
            toast.error(`Contractor ${code || name} is already assigned to this project.`);
            return;
          }
        } else {
          // Create a new contractor master row (do NOT reuse by name)
          const { data, error } = await supabase.from("contractors").insert(form).select("id").single();
          if (error) {
            if ((error as any).code === "23505") {
              toast.error(`Contractor code "${code}" already exists. Please use a different code.`);
              return;
            }
            throw error;
          }
          contractorId = (data as any)?.id;
        }

        // Assign contractor to the current project
        if (contractorId) {
          const { error: e2 } = await supabase.from("project_contractors").insert({ project_id: projectId, contractor_id: contractorId });
          if (e2) {
            if ((e2 as any).code === "23505") {
              toast.error(`Contractor ${code || name} is already assigned to this project.`);
              return;
            }
            throw e2;
          }
        }
      }

      toast.success(editing ? "Updated" : "Created");
      setOpen(false); setEditing(null); setForm({ contractor_code: "", company_name: "", contact_person: "", phone: "", license_number: "", contact_number: "", work_place: "", nature_of_work: "" }); load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (c: any) => { if (!requireEdit()) return; setEditing(c); setForm({ contractor_code: c.contractor_code || "", company_name: c.company_name, contact_person: c.contact_person || "", phone: c.phone || "", license_number: c.license_number || "", contact_number: c.contact_number || "", work_place: c.work_place || "", nature_of_work: c.nature_of_work || "" }); setOpen(true); };
  const handleDelete = async (id: string) => { if (!requireEdit()) return; if (!confirm("Delete?")) return; await supabase.from("contractors").delete().eq("id", id); toast.success("Deleted"); load(); };
  const filtered = items.filter((c) => c.company_name.toLowerCase().includes(search.toLowerCase()));

  const CSV_COLUMNS = ["contractor_code", "company_name", "contact_person", "phone", "contact_number", "work_place", "nature_of_work", "license_number"];

  const csvEscape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    downloadCsv("contractors_template.csv", [CSV_COLUMNS, ["C-001", "ABC Builders", "John Doe", "022-1234567", "9876543210", "Block E1", "Civil", "LIC-001"]]);
  };

  const handleDownloadData = () => {
    const rows = [CSV_COLUMNS, ...items.map((c) => CSV_COLUMNS.map((k) => c[k] ?? ""))];
    downloadCsv(`contractors_${format(new Date(), "yyyyMMdd")}.csv`, rows);
    toast.success(`Exported ${items.length} contractors`);
  };

  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let cur: string[] = [], val = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"' && text[i + 1] === '"') { val += '"'; i++; }
        else if (ch === '"') inQ = false;
        else val += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { cur.push(val); val = ""; }
        else if (ch === "\n") { cur.push(val); rows.push(cur); cur = []; val = ""; }
        else if (ch === "\r") { /* skip */ }
        else val += ch;
      }
    }
    if (val.length || cur.length) { cur.push(val); rows.push(cur); }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!requireEdit()) { e.target.value = ""; return; }
    if (!projectId) { toast.error("Select a project first"); e.target.value = ""; return; }
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { toast.error("CSV is empty"); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());

      const emptyRowNos: number[] = [];
      const dupInCsv: { row: number; code: string }[] = [];
      const seenCodes = new Map<string, number>(); // code -> first csv row no
      const records: { row: number; data: any }[] = [];

      rows.slice(1).forEach((r, i) => {
        const rowNo = i + 2; // header is row 1
        const obj: any = {};
        CSV_COLUMNS.forEach((col) => {
          const idx = header.indexOf(col);
          if (idx >= 0) obj[col] = r[idx]?.trim() || null;
        });
        if (obj.contact_number) {
          const digits = String(obj.contact_number).replace(/\D/g, "").slice(0, 10);
          obj.contact_number = digits.length === 10 ? digits : null;
        }
        const code = (obj.contractor_code || "").trim();
        const name = (obj.company_name || "").trim();
        if (!code && !name) { emptyRowNos.push(rowNo); return; }
        if (code) {
          const key = code.toLowerCase();
          if (seenCodes.has(key)) { dupInCsv.push({ row: rowNo, code }); return; }
          seenCodes.set(key, rowNo);
        }
        // Ensure a usable company_name (DB requires NOT NULL)
        if (!name) obj.company_name = code;
        records.push({ row: rowNo, data: obj });
      });

      if (records.length === 0) {
        toast.error("No valid rows found in CSV");
        return;
      }

      // Project-scoped dedupe by SC Code only. Same name with different
      // code must create a new contractor row.
      const existingByCode = new Map<string, string>(); // code -> contractor_id
      items.forEach((c) => {
        const code = (c.contractor_code || "").trim().toLowerCase();
        if (code) existingByCode.set(code, c.id);
      });

      const toUpdate: { id: string; data: any }[] = [];
      const toCreate: any[] = [];
      for (const { data } of records) {
        const code = (data.contractor_code || "").trim().toLowerCase();
        const existingId = code ? existingByCode.get(code) : undefined;
        if (existingId) toUpdate.push({ id: existingId, data });
        else toCreate.push(data);
      }


      const failed: string[] = [];
      let createdCount = 0;
      let updatedCount = 0;

      // Per-row insert so one bad row doesn't abort the whole upload
      for (const row of toCreate) {
        const { data: ins, error: insErr } = await supabase
          .from("contractors").insert(row).select("id").single();
        if (insErr || !ins) {
          failed.push(row.contractor_code || row.company_name || "(unnamed)");
          continue;
        }
        const { error: linkErr } = await supabase
          .from("project_contractors")
          .insert({ project_id: projectId, contractor_id: ins.id });
        if (linkErr && (linkErr as any).code !== "23505") {
          failed.push(row.contractor_code || row.company_name || "(unnamed)");
          continue;
        }
        createdCount++;
      }

      for (const { id, data } of toUpdate) {
        const { error: upErr } = await supabase
          .from("contractors").update(data).eq("id", id);
        if (upErr) { failed.push(data.contractor_code || data.company_name || "(unnamed)"); continue; }
        updatedCount++;
      }

      const parts: string[] = [];
      parts.push(`Imported ${createdCount} new`);
      if (updatedCount) parts.push(`updated ${updatedCount} existing`);
      const skippedTotal = emptyRowNos.length + dupInCsv.length;
      if (skippedTotal) parts.push(`skipped ${skippedTotal} CSV row(s)`);
      toast.success(parts.join(", "));

      if (emptyRowNos.length) {
        toast.warning(`Empty rows skipped: line ${emptyRowNos.slice(0, 10).join(", ")}${emptyRowNos.length > 10 ? "…" : ""}`);
      }
      if (dupInCsv.length) {
        const preview = dupInCsv.slice(0, 5).map((d) => `line ${d.row} (${d.code})`).join(", ");
        toast.warning(`Duplicate codes inside CSV skipped: ${preview}${dupInCsv.length > 5 ? "…" : ""}`);
      }
      if (failed.length) {
        const preview = failed.slice(0, 5).join(", ");
        toast.error(`Could not import ${failed.length} row(s): ${preview}${failed.length > 5 ? "…" : ""}`);
      }
      await load();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      e.target.value = "";
    }
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Contractors"
        subtitle="Manage contractors and view workforce overview"
        actions={
          <>
            <Button variant="outline" onClick={handleDownloadTemplate}><FileDown className="mr-2 h-4 w-4" />Template</Button>
            <input
              id="contractors-csv-upload"
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              className="hidden"
              onChange={handleUpload}
            />
            <Button variant="outline" onClick={() => document.getElementById("contractors-csv-upload")?.click()}>
              <Upload className="mr-2 h-4 w-4" />Upload
            </Button>
            <Button variant="outline" onClick={handleDownloadData}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog open={open} onOpenChange={(o) => { if (o && !requireEdit()) return; setOpen(o); if (!o) { setEditing(null); setForm({ contractor_code: "", company_name: "", contact_person: "", phone: "", license_number: "", contact_number: "", work_place: "", nature_of_work: "" }); } }}>
              <DialogTrigger asChild><Button disabled={!projectId}><Plus className="mr-2 h-4 w-4" />Add Contractor</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Contractor</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Contractor Code</Label><Input value={form.contractor_code} onChange={(e) => setForm({ ...form, contractor_code: e.target.value })} placeholder="e.g. C-001" /></div>
                  <div><Label>Company Name *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
                  <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Contact Number</Label><Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" maxLength={10} placeholder="10-digit mobile number" /></div>
                  <div><Label>Work Place / Location</Label><Input value={form.work_place} onChange={(e) => setForm({ ...form, work_place: e.target.value })} placeholder="e.g. Block E1, F1" /></div>
                  <div><Label>Nature of Work</Label><Input value={form.nature_of_work} onChange={(e) => setForm({ ...form, nature_of_work: e.target.value })} placeholder="e.g. Civil, Electrical, Plumbing" /></div>
                  <div><Label>License Number</Label><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
                  <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* Project selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Project *</Label>
              <ProjectCombobox value={projectId} onChange={setProjectId} projects={projects} placeholder="Select a project" className="w-[280px]" />
            </div>
            {!projectId && (
              <p className="text-sm text-muted-foreground pb-2">Select a project to view and manage its contractors.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {projectId && <>
      {/* Dashboard Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <DatePicker value={dateFrom} onChange={setDateFrom} label="From" />
            <DatePicker value={dateTo} onChange={setDateTo} label="To" />
            <div className="space-y-1">
              <Label>Contractor</Label>
              <Select value={contractorId} onValueChange={setContractorId}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contractors</SelectItem>
                  {items.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
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

      {/* Contractors by Nature of Work */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Contractors by Nature of Work</CardTitle></CardHeader>
        <CardContent>
          {contractorsByNature.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No contractors yet</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contractorsByNature} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" allowDecimals={false} className="text-xs" />
                    <YAxis type="category" dataKey="name" width={160} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="oklch(0.55 0.2 280)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nature of Work</TableHead>
                      <TableHead className="text-right">Contractors</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractorsByNature.map((n) => (
                      <TableRow key={n.name}>
                        <TableCell className="font-medium">{n.name}</TableCell>
                        <TableCell className="text-right">{n.count}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {items.length ? Math.round((n.count / items.length) * 100) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Worker Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
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
        <Card>
          <CardHeader><CardTitle className="text-lg">Top Contractors</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topContractors} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="total" fill="oklch(0.65 0.18 160)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contractors List — moved to bottom */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Contractors List ({items.length})</CardTitle>
          <Input placeholder="Search contractors..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Company Name</TableHead><TableHead>Contact Person</TableHead><TableHead>Phone</TableHead><TableHead>Contact #</TableHead><TableHead>Work Place</TableHead><TableHead>Nature of Work</TableHead><TableHead>License #</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} data-row-id={c.id}>
                  <TableCell className="font-mono text-xs">{c.contractor_code || "—"}</TableCell>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell>{c.contact_person || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.contact_number || "—"}</TableCell>
                  <TableCell>{c.work_place || "—"}</TableCell>
                  <TableCell>{c.nature_of_work || "—"}</TableCell>
                  <TableCell>{c.license_number || "—"}</TableCell>
                  <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No contractors found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
