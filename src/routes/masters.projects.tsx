import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/masters/projects")({
  component: () => <AuthGuard><ProjectsPage /></AuthGuard>,
});

function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", code: "", division: "", location: "", start_date: "", status: "Active" });
  const [search, setSearch] = useState("");

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
      setForm({ name: "", code: "", division: "", location: "", start_date: "", status: "Active" });
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, code: p.code || "", division: p.division || "", location: p.location || "", start_date: p.start_date || "", status: p.status });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    await supabase.from("projects").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage project master data</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ name: "", code: "", division: "", location: "", start_date: "", status: "Active" }); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Project</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Project</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. GENMNGR" /></div>
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
      <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
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
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No projects found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
