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
import { CalendarIcon, Plus, Copy, Trash2, Save, FileDown, Upload } from "lucide-react";
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
    setProjects(p.data || []);
    setContractors(c.data || []);
    setDepartments(d.data || []);
    setCategories(cat.data || []);
    const map: Record<string, string[]> = {};
    (dcLinks.data || []).forEach((link: any) => {
      if (!map[link.department_id]) map[link.department_id] = [];
      map[link.department_id].push(link.category_id);
    });
    setDeptCategoryMap(map);
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Manpower Entry</h1>
          <p className="text-sm text-muted-foreground">Record daily workforce data</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" />
          <Button variant="outline" onClick={downloadTemplate}><FileDown className="mr-2 h-4 w-4" />Template</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={bulkUploading}>
            <Upload className="mr-2 h-4 w-4" />{bulkUploading ? "Uploading..." : "Bulk Upload"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "dd MMM yyyy") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Project</label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{[p.code && `[${p.code}]`, p.name, p.project_group && `— ${p.project_group}`].filter(Boolean).join(" ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {projectId && (
          <>
            <Button variant="outline" onClick={copyPreviousDay}><Copy className="mr-2 h-4 w-4" />Copy Previous Day</Button>
            <Button onClick={addRow}><Plus className="mr-2 h-4 w-4" />Add Row</Button>
          </>
        )}
      </div>

      {projectId && rows.length > 0 && (
        <Card>
          {(() => {
            const sel = projects.find((p) => p.id === projectId);
            if (!sel) return null;
            return (
              <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 border-b text-sm">
                <span><span className="text-muted-foreground">Code:</span> <span className="font-mono font-medium">{sel.code || "—"}</span></span>
                <span><span className="text-muted-foreground">Project:</span> <span className="font-medium">{sel.name}</span></span>
                <span><span className="text-muted-foreground">Group:</span> <span className="font-medium">{sel.project_group || "—"}</span></span>
              </div>
            );
          })()}
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-20">Count</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={row.contractor_id} onValueChange={(v) => updateRow(idx, "contractor_id", v)}>
                          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{contractors.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.department_id} onValueChange={(v) => updateRow(idx, "department_id", v)}>
                          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const linked = deptCategoryMap[row.department_id];
                          const filteredCats = linked && linked.length > 0
                            ? categories.filter((c) => linked.includes(c.id))
                            : categories;
                          return (
                            <Select value={row.category_id} onValueChange={(v) => updateRow(idx, "category_id", v)}>
                              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>{filteredCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                          );
                        })()}
                      </TableCell>
                      <TableCell><Input type="number" min={0} value={row.headcount} onChange={(e) => updateRow(idx, "headcount", parseInt(e.target.value) || 0)} className="w-20" /></TableCell>
                      <TableCell><Input value={row.remarks} onChange={(e) => updateRow(idx, "remarks", e.target.value)} placeholder="Notes..." className="w-[150px]" /></TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeRow(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {projectId && rows.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="lg">
            <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Entries"}
          </Button>
        </div>
      )}

      {projectId && rows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No entries yet. Click "Add Row" or "Copy Previous Day" to start.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
