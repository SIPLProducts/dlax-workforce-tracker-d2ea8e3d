import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/masters/departments")({
  component: () => <ScreenGuard screen="masters_departments"><DepartmentsPage /></ScreenGuard>,
});

function DepartmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [deptCategoryMap, setDeptCategoryMap] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<any>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [name, setName] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
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

      await supabase.from("department_categories").delete().eq("department_id", deptId);
      if (selectedCategoryIds.length > 0) {
        const links = selectedCategoryIds.map((cid) => ({ department_id: deptId, category_id: cid }));
        const { error: linkErr } = await supabase.from("department_categories").insert(links);
        if (linkErr) throw linkErr;
      }

      toast.success(editing ? "Updated" : "Created");
      cancelForm();
      load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleEdit = (d: any) => {
    setShowInlineForm(false);
    setEditing(d);
    setName(d.name);
    setSelectedCategoryIds(deptCategoryMap[d.id] || []);
  };

  const cancelForm = () => {
    setEditing(null);
    setShowInlineForm(false);
    setName("");
    setSelectedCategoryIds([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category of labour?")) return;
    await supabase.from("departments").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const startAdd = () => {
    setEditing(null);
    setName("");
    setSelectedCategoryIds([]);
    setShowInlineForm(true);
  };

  const filtered = items.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  const isFormVisible = showInlineForm || editing;

  const renderInlineForm = (key?: string) => (
    <TableRow key={key} className="border-b border-dashed border-primary/30 bg-primary/5">
      <TableCell className="align-top py-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Civil, MEP, Security"
          className="h-9 max-w-[200px]"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") cancelForm();
          }}
        />
      </TableCell>
      <TableCell className="align-top py-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {allCategories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-1.5 cursor-pointer text-sm select-none">
              <Checkbox
                checked={selectedCategoryIds.includes(cat.id)}
                onCheckedChange={() => toggleCategory(cat.id)}
                className="h-4 w-4"
              />
              <span>{cat.name}</span>
            </label>
          ))}
          {allCategories.length === 0 && (
            <span className="text-sm text-muted-foreground italic">No categories created yet</span>
          )}
        </div>
      </TableCell>
      <TableCell className="align-top py-3">
        <div className="flex gap-1">
          <Button
            variant="default"
            size="icon"
            onClick={handleSave}
            disabled={saving}
            className="h-8 w-8"
            title="Save"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={cancelForm}
            className="h-8 w-8"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Category of Labour</h1>
          <p className="text-sm text-muted-foreground">Manage categories of labour and their worker sub-categories</p>
        </div>
        <Button onClick={startAdd} disabled={!!isFormVisible}>
          <Plus className="mr-2 h-4 w-4" />Add Category of Labour
        </Button>
      </div>

      <Input placeholder="Search categories of labour..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showInlineForm && !editing && renderInlineForm("new-row")}
              {filtered.map((d) =>
                editing?.id === d.id ? (
                  renderInlineForm(d.id)
                ) : (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(deptCategoryMap[d.id] || []).map((catId) => {
                          const cat = allCategories.find((c) => c.id === catId);
                          return cat ? <Badge key={catId} variant="secondary" className="text-xs">{cat.name}</Badge> : null;
                        })}
                        {(!deptCategoryMap[d.id] || deptCategoryMap[d.id].length === 0) && (
                          <span className="text-xs text-muted-foreground">All categories</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(d)} disabled={!!isFormVisible}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} disabled={!!isFormVisible}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
              {filtered.length === 0 && !showInlineForm && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No categories of labour found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
