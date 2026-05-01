import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/masters/categories")({
  component: () => <AuthGuard><CategoriesPage /></AuthGuard>,
});

const GROUPS = ["CIVIL", "MEP", "NMR"] as const;

function CategoriesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<{ name: string; category_group: string; display_order: number }>({ name: "", category_group: "", display_order: 0 });
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("worker_categories").select("*").order("category_group", { nullsFirst: false }).order("display_order").order("name");
    setItems(data || []);
  };

  const resetForm = () => setForm({ name: "", category_group: "", display_order: 0 });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      category_group: form.category_group || null,
      display_order: form.display_order || 0,
    };
    try {
      if (editing) {
        const { error } = await supabase.from("worker_categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("worker_categories").insert(payload);
        if (error) throw error;
      }
      toast.success(editing ? "Updated" : "Created");
      setOpen(false); setEditing(null); resetForm(); load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (d: any) => {
    setEditing(d);
    setForm({ name: d.name, category_group: d.category_group || "", display_order: d.display_order || 0 });
    setOpen(true);
  };
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("worker_categories").delete().eq("id", id); toast.success("Deleted"); load(); };
  const filtered = items.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Worker Categories</h1><p className="text-sm text-muted-foreground">Manage worker categories. Set group (CIVIL / MEP / NMR) and order to control how they appear in the Daily Entry spreadsheet.</p></div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); resetForm(); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Category</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Category</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mason, Helper, Plumber" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Group</Label>
                  <Select value={form.category_group || "none"} onValueChange={(v) => setForm({ ...form, category_group: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Display order</Label>
                  <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Input placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="w-32">Group</TableHead><TableHead className="w-24">Order</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.category_group || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="tabular-nums">{d.display_order || 0}</TableCell>
                <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(d)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No categories found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
