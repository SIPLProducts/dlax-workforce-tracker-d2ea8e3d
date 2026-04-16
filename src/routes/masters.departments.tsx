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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/masters/departments")({
  component: () => <AuthGuard><DepartmentsPage /></AuthGuard>,
});

function DepartmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [deptCategoryMap, setDeptCategoryMap] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [deptRes, catRes, linkRes] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("worker_categories").select("*").order("name"),
      supabase.from("department_categories").select("*"),
    ]);
    setItems(deptRes.data || []);
    setAllCategories(catRes.data || []);

    const map: Record<string, string[]> = {};
    (linkRes.data || []).forEach((link: any) => {
      if (!map[link.department_id]) map[link.department_id] = [];
      map[link.department_id].push(link.category_id);
    });
    setDeptCategoryMap(map);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    try {
      let deptId: string;
      if (editing) {
        const { error } = await supabase.from("departments").update({ name }).eq("id", editing.id);
        if (error) throw error;
        deptId = editing.id;
      } else {
        const { data, error } = await supabase.from("departments").insert({ name }).select("id").single();
        if (error) throw error;
        deptId = data.id;
      }

      // Sync category links
      await supabase.from("department_categories").delete().eq("department_id", deptId);
      if (selectedCategoryIds.length > 0) {
        const links = selectedCategoryIds.map((cid) => ({ department_id: deptId, category_id: cid }));
        const { error: linkErr } = await supabase.from("department_categories").insert(links);
        if (linkErr) throw linkErr;
      }

      toast.success(editing ? "Updated" : "Created");
      setOpen(false); setEditing(null); setName(""); setSelectedCategoryIds([]); load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (d: any) => {
    setEditing(d);
    setName(d.name);
    setSelectedCategoryIds(deptCategoryMap[d.id] || []);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete?")) return;
    await supabase.from("departments").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const filtered = items.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Departments</h1><p className="text-sm text-muted-foreground">Manage departments / trades and their worker categories</p></div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setName(""); setSelectedCategoryIds([]); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Department</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Department</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Civil, Electrical" /></div>
              <div>
                <Label>Worker Categories</Label>
                <p className="text-xs text-muted-foreground mb-2">Select which categories belong to this department</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {allCategories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedCategoryIds.includes(cat.id)}
                        onCheckedChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))}
                  {allCategories.length === 0 && <p className="text-xs text-muted-foreground col-span-2">No categories found. Create them first.</p>}
                </div>
              </div>
              <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Input placeholder="Search departments..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Categories</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(deptCategoryMap[d.id] || []).map((catId) => {
                      const cat = allCategories.find((c) => c.id === catId);
                      return cat ? <Badge key={catId} variant="secondary" className="text-xs">{cat.name}</Badge> : null;
                    })}
                    {(!deptCategoryMap[d.id] || deptCategoryMap[d.id].length === 0) && <span className="text-xs text-muted-foreground">All categories</span>}
                  </div>
                </TableCell>
                <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(d)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No departments found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
