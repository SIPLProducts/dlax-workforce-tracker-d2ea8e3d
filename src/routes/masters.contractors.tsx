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

export const Route = createFileRoute("/masters/contractors")({
  component: () => <AuthGuard><ContractorsPage /></AuthGuard>,
});

function ContractorsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ company_name: "", contact_person: "", phone: "", license_number: "", contact_number: "", work_place: "" });
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("contractors").select("*").order("company_name");
    setItems(data || []);
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    try {
      if (editing) {
        const { error } = await supabase.from("contractors").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contractors").insert(form);
        if (error) throw error;
      }
      toast.success(editing ? "Updated" : "Created");
      setOpen(false); setEditing(null); setForm({ company_name: "", contact_person: "", phone: "", license_number: "", contact_number: "", work_place: "" }); load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (c: any) => { setEditing(c); setForm({ company_name: c.company_name, contact_person: c.contact_person || "", phone: c.phone || "", license_number: c.license_number || "", contact_number: c.contact_number || "", work_place: c.work_place || "" }); setOpen(true); };
  const handleDelete = async (id: string) => { if (!confirm("Delete?")) return; await supabase.from("contractors").delete().eq("id", id); toast.success("Deleted"); load(); };
  const filtered = items.filter((c) => c.company_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Contractors</h1><p className="text-sm text-muted-foreground">Manage contractor master data</p></div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ company_name: "", contact_person: "", phone: "", license_number: "", contact_number: "", work_place: "" }); } }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Contractor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Contractor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Company Name *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Contact Number</Label><Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="Mobile number" /></div>
              <div><Label>Work Place / Location</Label><Input value={form.work_place} onChange={(e) => setForm({ ...form, work_place: e.target.value })} placeholder="e.g. Block E1, F1" /></div>
              <div><Label>License Number</Label><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Input placeholder="Search contractors..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Company Name</TableHead><TableHead>Contact Person</TableHead><TableHead>Phone</TableHead><TableHead>Contact #</TableHead><TableHead>Work Place</TableHead><TableHead>License #</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.company_name}</TableCell>
                <TableCell>{c.contact_person || "—"}</TableCell>
                <TableCell>{c.phone || "—"}</TableCell>
                <TableCell>{c.contact_number || "—"}</TableCell>
                <TableCell>{c.work_place || "—"}</TableCell>
                <TableCell>{c.license_number || "—"}</TableCell>
                <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No contractors found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
