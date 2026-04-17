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
import { CalendarIcon, Plus, Copy, Trash2, Save } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Daily Manpower Entry</h1>
        <p className="text-sm text-muted-foreground">Record daily workforce data</p>
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
