import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Copy, Trash2, Save, FileDown, Upload, ClipboardList, Users, Inbox } from "lucide-react";
import { format, subDays, parse as parseDate } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";
import { useRef } from "react";

export const Route = createFileRoute("/daily-entry")({
  component: () => <AuthGuard><DailyEntryPage /></AuthGuard>,
});

type ManpowerRow = {
  id?: string;
  contractor_id: string;
  department_id: string;
  category_id: string;
  headcount: number;
  remarks: string;
};

function DailyEntryPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [deptCategoryMap, setDeptCategoryMap] = useState<Record<string, string[]>>({});
  const [rows, setRows] = useState<ManpowerRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [mastersLoaded, setMastersLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (projectId && date) loadEntries();
  }, [projectId, date]);

  const loadMasters = async () => {
    const [p, c, d, cat, dcLinks] = await Promise.all([
      supabase.from("projects").select("*").eq("status", "Active").order("name"),
      supabase.from("contractors").select("*").order("company_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("worker_categories").select("*").order("name"),
      supabase.from("department_categories").select("*"),
    ]);
    const projectList = p.data || [];
    setProjects(projectList);
    // Auto-select if user has access to exactly 1 project
    if (projectList.length === 1 && !projectId) {
      setProjectId(projectList[0].id);
    }
    setContractors(c.data || []);
    setDepartments(d.data || []);
    setCategories(cat.data || []);
    const map: Record<string, string[]> = {};
    (dcLinks.data || []).forEach((link: any) => {
      if (!map[link.department_id]) map[link.department_id] = [];
      map[link.department_id].push(link.category_id);
    });
    setDeptCategoryMap(map);
    setMastersLoaded(true);
  };

  const loadEntries = async () => {
    const { data } = await supabase
      .from("daily_manpower")
      .select("*")
      .eq("entry_date", format(date, "yyyy-MM-dd"))
      .eq("project_id", projectId);
    if (data && data.length > 0) {
      setRows(data.map((r) => ({
        id: r.id,
        contractor_id: r.contractor_id,
        department_id: r.department_id,
        category_id: r.category_id,
        headcount: r.headcount,
        remarks: r.remarks || "",
      })));
    } else {
      setRows([]);
    }
  };

  const addRow = () => {
    setRows([...rows, { contractor_id: "", department_id: "", category_id: "", headcount: 0, remarks: "" }]);
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof ManpowerRow, value: any) => {
    setRows(rows.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      // Reset category when department changes
      if (field === "department_id" && value !== r.department_id) {
        updated.category_id = "";
      }
      return updated;
    }));
  };

  const copyPreviousDay = async () => {
    const prevDate = format(subDays(date, 1), "yyyy-MM-dd");
    const { data } = await supabase
      .from("daily_manpower")
      .select("*")
      .eq("entry_date", prevDate)
      .eq("project_id", projectId);
    if (data && data.length > 0) {
      setRows(data.map((r) => ({
        contractor_id: r.contractor_id,
        department_id: r.department_id,
        category_id: r.category_id,
        headcount: r.headcount,
        remarks: r.remarks || "",
      })));
      toast.success("Copied from previous day");
    } else {
      toast.info("No entries found for previous day");
    }
  };

  const save = async () => {
    if (!projectId) { toast.error("Select a project"); return; }
    if (rows.length === 0) { toast.error("Add at least one row"); return; }
    for (const r of rows) {
      if (!r.contractor_id || !r.department_id || !r.category_id) {
        toast.error("Fill all required fields in each row");
        return;
      }
    }
    setSaving(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      // Delete existing entries for this date/project
      await supabase.from("daily_manpower").delete().eq("entry_date", dateStr).eq("project_id", projectId);
      // Insert new
      const inserts = rows.map((r) => ({
        entry_date: dateStr,
        project_id: projectId,
        contractor_id: r.contractor_id,
        department_id: r.department_id,
        category_id: r.category_id,
        headcount: r.headcount,
        remarks: r.remarks || null,
        created_by: user?.id,
      }));
      const { error } = await supabase.from("daily_manpower").insert(inserts);
      if (error) throw error;
      toast.success("Saved successfully");
      loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const sampleDate = format(new Date(), "yyyy-MM-dd");
    const sampleProject = projects[0]?.code || "PROJ-001";
    const sampleContractor = contractors[0]?.company_name || "Contractor Name";
    const sampleDept = departments[0]?.name || "Civil";
    const sampleCat = categories[0]?.name || "Helper";
    const data = [
      {
        entry_date: sampleDate,
        project_code: sampleProject,
        contractor: sampleContractor,
        department: sampleDept,
        category: sampleCat,
        headcount: 10,
        remarks: "Optional notes",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data, {
      header: ["entry_date", "project_code", "contractor", "department", "category", "headcount", "remarks"],
    });
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DailyEntry");
    // Reference sheet
    const ref: any[] = [];
    ref.push({ Type: "Project Codes", Values: projects.map((p) => p.code).filter(Boolean).join(", ") });
    ref.push({ Type: "Contractors", Values: contractors.map((c) => c.company_name).join(", ") });
    ref.push({ Type: "Departments", Values: departments.map((d) => d.name).join(", ") });
    ref.push({ Type: "Categories", Values: categories.map((c) => c.name).join(", ") });
    const refWs = XLSX.utils.json_to_sheet(ref);
    refWs["!cols"] = [{ wch: 18 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(wb, refWs, "Reference");
    XLSX.writeFile(wb, "daily_entry_template.xlsx");
    toast.success("Template downloaded");
  };

  const parseExcelDate = (v: any): string | null => {
    if (!v) return null;
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return null;
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    const s = String(v).trim();
    // Try common formats
    for (const fmt of ["yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "d-MMM-yyyy", "dd-MMM-yyyy"]) {
      try {
        const d = parseDate(s, fmt, new Date());
        if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
      } catch {}
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
    return null;
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (json.length === 0) { toast.error("Sheet is empty"); return; }

      // Build lookup maps (case-insensitive)
      const projByCode = new Map(projects.filter((p) => p.code).map((p) => [String(p.code).toLowerCase().trim(), p]));
      const projByName = new Map(projects.map((p) => [String(p.name).toLowerCase().trim(), p]));
      const contMap = new Map(contractors.map((c) => [String(c.company_name).toLowerCase().trim(), c]));
      const deptMap = new Map(departments.map((d) => [String(d.name).toLowerCase().trim(), d]));
      const catMap = new Map(categories.map((c) => [String(c.name).toLowerCase().trim(), c]));

      const inserts: any[] = [];
      const errors: string[] = [];

      json.forEach((row, idx) => {
        const lineNo = idx + 2;
        const dateStr = parseExcelDate(row.entry_date ?? row.date ?? row.Date);
        if (!dateStr) { errors.push(`Row ${lineNo}: invalid date`); return; }
        const projKey = String(row.project_code ?? row.project ?? "").toLowerCase().trim();
        const proj = projByCode.get(projKey) || projByName.get(projKey);
        if (!proj) { errors.push(`Row ${lineNo}: project not found "${row.project_code ?? row.project}"`); return; }
        const cont = contMap.get(String(row.contractor ?? "").toLowerCase().trim());
        if (!cont) { errors.push(`Row ${lineNo}: contractor not found "${row.contractor}"`); return; }
        const dept = deptMap.get(String(row.department ?? "").toLowerCase().trim());
        if (!dept) { errors.push(`Row ${lineNo}: department not found "${row.department}"`); return; }
        const cat = catMap.get(String(row.category ?? "").toLowerCase().trim());
        if (!cat) { errors.push(`Row ${lineNo}: category not found "${row.category}"`); return; }
        const hc = parseInt(String(row.headcount ?? 0)) || 0;
        inserts.push({
          entry_date: dateStr,
          project_id: proj.id,
          contractor_id: cont.id,
          department_id: dept.id,
          category_id: cat.id,
          headcount: hc,
          remarks: row.remarks ? String(row.remarks) : null,
          created_by: user?.id,
        });
      });

      if (errors.length > 0 && inserts.length === 0) {
        toast.error(`Upload failed. ${errors.length} error(s). First: ${errors[0]}`);
        console.error("Bulk upload errors:", errors);
        return;
      }

      const { error } = await supabase.from("daily_manpower").insert(inserts);
      if (error) throw error;
      toast.success(`Uploaded ${inserts.length} entries${errors.length ? ` (${errors.length} skipped)` : ""}`);
      if (errors.length) console.warn("Skipped rows:", errors);
      if (projectId && date) loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selProj = projects.find((p) => p.id === projectId);
  const totalHeadcount = rows.reduce((s, r) => s + (r.headcount || 0), 0);

  return (
    <div className="space-y-5 md:space-y-6 pb-28 md:pb-24">
      {/* Page header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">Daily Operations</p>
            <h1 className="text-[24px] font-semibold text-foreground tracking-tight leading-tight mt-1">Daily Manpower Entry</h1>
            <p className="text-[13px] text-muted-foreground mt-1">Record daily workforce data across projects, contractors and departments.</p>
          </div>
          <div className="inline-flex items-center -space-x-px rounded-md shadow-sm">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" />
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-r-none focus:z-10"
              onClick={downloadTemplate}
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-l-none focus:z-10"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkUploading}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />{bulkUploading ? "Uploading..." : "Bulk Upload"}
            </Button>
          </div>
        </div>
        <div className="hairline-x h-px w-full" />
      </div>

      {mastersLoaded && projects.length === 0 && (
        <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="py-14 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
              <Inbox className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <p className="text-base font-medium text-foreground">No projects assigned to your account</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ask an administrator to assign projects to you under <span className="font-medium text-foreground">User Management → Projects</span>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="bg-card border border-border/70 rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 surface-elevated">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-9 justify-start text-left font-medium w-full sm:w-[180px] bg-background hover:bg-muted/40 transition-colors",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {date ? format(date, "dd MMM yyyy") : "Pick date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <div className="hidden sm:block h-6 w-px bg-border/70" />

        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-full sm:w-[280px] bg-background hover:bg-muted/40 transition-colors font-medium data-[placeholder]:font-normal">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{[p.code && `[${p.code}]`, p.name, p.project_group && `— ${p.project_group}`].filter(Boolean).join(" ")}</SelectItem>)}
          </SelectContent>
        </Select>

        {projectId && (
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground" onClick={copyPreviousDay}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />Copy Previous Day
            </Button>
            <Button size="sm" className="h-9 shadow-sm hover:shadow transition-shadow" onClick={addRow}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Add Row
            </Button>
          </div>
        )}
      </div>

      {/* Project context strip */}
      {projectId && selProj && (
        <div className="bg-gradient-to-r from-muted/50 via-muted/25 to-muted/10 border border-border/60 rounded-lg px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-y-2 gap-x-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/80 shrink-0" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">Project</span>
            {selProj.code && (
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-background border border-border/60 text-foreground shrink-0">
                {selProj.code}
              </span>
            )}
            <span className="font-medium text-foreground truncate">{selProj.name}</span>
            {selProj.project_group && (
              <span className="text-muted-foreground truncate hidden sm:inline">· {selProj.project_group}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 sm:border-l sm:border-border/60 sm:pl-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total</span>
            <span className="text-[15px] font-semibold text-foreground tabular-nums">{totalHeadcount}</span>
            <span className="text-muted-foreground text-xs">/ {rows.length} row{rows.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      )}

      {/* No project selected — premium empty state */}
      {mastersLoaded && projects.length > 0 && !projectId && (
        <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="py-16 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Select a project to begin</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Choose a project from the picker above to load today's manpower entries.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {projectId && rows.length > 0 && (
        <Card className="overflow-hidden border border-border/70 rounded-xl shadow-none surface-elevated">
          <CardContent className="p-0">
            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/70">
                    <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Contractor</TableHead>
                    <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Department</TableHead>
                    <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Category</TableHead>
                    <TableHead className="h-11 w-24 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground text-right">Count</TableHead>
                    <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Remarks</TableHead>
                    <TableHead className="h-11 w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
                    const linked = deptCategoryMap[row.department_id];
                    const filteredCats = linked && linked.length > 0 ? categories.filter((c) => linked.includes(c.id)) : categories;
                    const isLast = idx === rows.length - 1;
                    return (
                      <TableRow key={idx} className={cn("group transition-colors hover:bg-muted/30", !isLast && "border-b border-border/40")}>
                        <TableCell className="py-2">
                          <Select value={row.contractor_id} onValueChange={(v) => updateRow(idx, "contractor_id", v)}>
                            <SelectTrigger className="w-[170px] h-9 border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input transition-colors"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{contractors.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2">
                          <Select value={row.department_id} onValueChange={(v) => updateRow(idx, "department_id", v)}>
                            <SelectTrigger className="w-[150px] h-9 border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input transition-colors"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2">
                          <Select value={row.category_id} onValueChange={(v) => updateRow(idx, "category_id", v)}>
                            <SelectTrigger className="w-[140px] h-9 border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus:border-input transition-colors"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <Input type="number" inputMode="numeric" min={0} value={row.headcount}
                            onChange={(e) => updateRow(idx, "headcount", parseInt(e.target.value) || 0)}
                            className="w-20 ml-auto h-9 text-right tabular-nums font-semibold border-transparent bg-transparent shadow-none hover:bg-muted/50 focus:bg-background focus-visible:border-input transition-colors" />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input value={row.remarks} onChange={(e) => updateRow(idx, "remarks", e.target.value)}
                            placeholder="Add notes…" className="w-[200px] h-9 border-transparent bg-transparent shadow-none hover:bg-muted/50 focus-visible:bg-background focus-visible:border-input transition-colors" />
                        </TableCell>
                        <TableCell className="py-2">
                          <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border/40">
              {rows.map((row, idx) => {
                const linked = deptCategoryMap[row.department_id];
                const filteredCats = linked && linked.length > 0 ? categories.filter((c) => linked.includes(c.id)) : categories;
                return (
                  <div key={idx} className="p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Row {idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeRow(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Contractor</label>
                      <Select value={row.contractor_id} onValueChange={(v) => updateRow(idx, "contractor_id", v)}>
                        <SelectTrigger className="w-full h-11 bg-background mt-1"><SelectValue placeholder="Select contractor" /></SelectTrigger>
                        <SelectContent>{contractors.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Department</label>
                        <Select value={row.department_id} onValueChange={(v) => updateRow(idx, "department_id", v)}>
                          <SelectTrigger className="w-full h-11 bg-background mt-1"><SelectValue placeholder="Dept" /></SelectTrigger>
                          <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Category</label>
                        <Select value={row.category_id} onValueChange={(v) => updateRow(idx, "category_id", v)}>
                          <SelectTrigger className="w-full h-11 bg-background mt-1"><SelectValue placeholder="Category" /></SelectTrigger>
                          <SelectContent>{filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Count</label>
                        <Input type="number" inputMode="numeric" min={0} value={row.headcount}
                          onChange={(e) => updateRow(idx, "headcount", parseInt(e.target.value) || 0)}
                          className="h-11 text-base font-semibold tabular-nums bg-background mt-1" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Remarks</label>
                        <Input value={row.remarks} onChange={(e) => updateRow(idx, "remarks", e.target.value)}
                          placeholder="Notes..." className="h-11 bg-background mt-1" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save bar — desktop sticky footer */}
      {projectId && rows.length > 0 && (
        <>
          <div className="hidden md:flex fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width,16rem)] z-30 border-t border-border/70 bg-background/85 backdrop-blur-md px-6 py-3">
            <div className="absolute top-0 left-0 right-0 h-px hairline-x-primary" aria-hidden />
            <div className="flex items-center justify-between gap-4 w-full max-w-screen-2xl mx-auto">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-muted-foreground/70" />
                <span>Total <span className="font-semibold text-foreground tabular-nums">{totalHeadcount}</span></span>
                <span className="text-border">·</span>
                <span>{rows.length} row{rows.length === 1 ? "" : "s"}</span>
                <span className="text-border">·</span>
                <span>{format(date, "dd MMM yyyy")}</span>
              </div>
              <Button onClick={save} disabled={saving} className="shadow-sm hover:shadow transition-shadow">
                <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Entries"}
              </Button>
            </div>
          </div>
          <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            <div className="absolute top-0 left-0 right-0 h-px hairline-x-primary" aria-hidden />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground tabular-nums text-base">{totalHeadcount}</span> total · {rows.length} row{rows.length === 1 ? "" : "s"}
              </div>
              <Button onClick={save} disabled={saving} size="lg" className="flex-shrink-0 shadow-sm">
                <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </>
      )}

      {projectId && rows.length === 0 && (
        <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="py-14 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">No entries yet for this date</p>
              <p className="text-sm text-muted-foreground">Add a row manually or copy from the previous day to get started.</p>
            </div>
            <div className="flex gap-2 justify-center pt-1">
              <Button variant="outline" size="sm" onClick={copyPreviousDay}><Copy className="mr-2 h-3.5 w-3.5" />Copy Previous Day</Button>
              <Button size="sm" onClick={addRow} className="shadow-sm"><Plus className="mr-2 h-3.5 w-3.5" />Add first row</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
