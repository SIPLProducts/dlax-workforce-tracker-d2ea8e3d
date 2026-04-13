import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/masters/departments")({
  component: () => <AuthGuard><DepartmentsPage /></AuthGuard>,
});

function DepartmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    setItems(data || []);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    try {
      if (editing) {
        const { error } = await supabase.from("departments").update({ name }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert({ name });
        if (error) throw error;
      }
      toast.success(editing ? "Updated" : "Created");
      setOpen(false); setEditing(null); setName(""); load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (d: any) => { setEditing(d); setName(d.name); setOpen(true); };
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("departments").delete().eq("id", id); toast.success("Deleted"); load(); };
  const filtered = items.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Departments</h1><p className="text-sm text-muted-foreground">Manage departments / trades</p></div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setName(""); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Department</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Department</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Civil, Electrical" /></div>
              <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Input placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(d)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No departments found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
