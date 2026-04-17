import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Download, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/masters/projects")({
  component: () => <AuthGuard><ProjectsPage /></AuthGuard>,
});

const TEMPLATE_HEADERS = ["name", "code", "project_group", "division", "location", "start_date", "status"];

function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", code: "", division: "", project_group: "", location: "", start_date: "", status: "Active" });
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("projects").select("*").order("name");
    setProjects(data || []);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    try {
      if (editing) {
        const { error } = await supabase.from("projects").update(form).eq("id", editing.id);
        if (error) throw error;
        toast.success("Updated");
      } else {
        const { error } = await supabase.from("projects").insert(form);
        if (error) throw error;
        toast.success("Created");
      }
      setOpen(false);
      setEditing(null);
      setForm({ name: "", code: "", division: "", project_group: "", location: "", start_date: "", status: "Active" });
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, code: p.code || "", division: p.division || "", project_group: p.project_group || "", location: p.location || "", start_date: p.start_date || "", status: p.status });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    await supabase.from("projects").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  const downloadTemplate = () => {
    const sample = [{
      name: "Sample Project",
      code: "PRJ001",
      project_group: "Refinery",
      division: "MD(KAK)",
      location: "Kakinada",
      start_date: "2025-01-15",
      status: "Active",
    }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    XLSX.writeFile(wb, "projects_template.xlsx");
  };

  const downloadProjects = () => {
    if (projects.length === 0) { toast.error("No projects to export"); return; }
    const rows = projects.map((p) => ({
      name: p.name,
      code: p.code || "",
      project_group: p.project_group || "",
      division: p.division || "",
      location: p.location || "",
      start_date: p.start_date || "",
      status: p.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    XLSX.writeFile(wb, `projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rows.length === 0) { toast.error("No rows found"); return; }

      const payload = rows
        .filter((r) => (r.name || "").toString().trim())
        .map((r) => {
          let start = (r.start_date || "").toString().trim();
          if (start && !isNaN(Number(start))) {
            // Excel serial date
            const d = XLSX.SSF.parse_date_code(Number(start));
            if (d) start = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          }
          return {
            name: r.name.toString().trim(),
            code: (r.code || "").toString().trim() || null,
            project_group: (r.project_group || "").toString().trim() || null,
            division: (r.division || "").toString().trim() || null,
            location: (r.location || "").toString().trim() || null,
            start_date: start || null,
            status: (r.status || "Active").toString().trim() || "Active",
          };
        });

      if (payload.length === 0) { toast.error("No valid rows (name required)"); return; }

      const { error } = await supabase.from("projects").insert(payload);
      if (error) throw error;
      toast.success(`Imported ${payload.length} project(s)`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage project master data</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadTemplate}><FileDown className="mr-2 h-4 w-4" />Template</Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" onClick={downloadProjects}><Download className="mr-2 h-4 w-4" />Download</Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", code: "", division: "", project_group: "", location: "", start_date: "", status: "Active" }); } }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Project</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Project</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. GENMNGR" /></div>
                <div><Label>Project Group</Label><Input value={form.project_group} onChange={(e) => setForm({ ...form, project_group: e.target.value })} placeholder="e.g. Township, Refinery" /></div>
                <div><Label>Division</Label><Input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} placeholder="e.g. MD(KAK)" /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.code || "—"}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.project_group || "—"}</TableCell>
                  <TableCell>{p.division || "—"}</TableCell>
                  <TableCell>{p.location || "—"}</TableCell>
                  <TableCell>{p.start_date || "—"}</TableCell>
                  <TableCell><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "Active" ? "bg-accent/20 text-accent" : p.status === "Completed" ? "bg-muted text-muted-foreground" : "bg-chart-3/20 text-chart-3"}`}>{p.status}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No projects found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
