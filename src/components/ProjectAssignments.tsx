import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

type Item = { id: string; label: string };
type Kind = "contractors" | "departments" | "categories";

const KIND_CONFIG: Record<Kind, {
  title: string;
  joinTable: "project_contractors" | "project_departments" | "project_categories";
  joinFk: "contractor_id" | "department_id" | "category_id";
  masterTable: "contractors" | "departments" | "worker_categories";
  masterLabel: (row: any) => string;
  createPermScreen: string;
  newPlaceholder: string;
}> = {
  contractors: {
    title: "Contractors",
    joinTable: "project_contractors",
    joinFk: "contractor_id",
    masterTable: "contractors",
    masterLabel: (r) => r.company_name,
    createPermScreen: "masters_contractors",
    newPlaceholder: "New contractor company name",
  },
  departments: {
    title: "Departments",
    joinTable: "project_departments",
    joinFk: "department_id",
    masterTable: "departments",
    masterLabel: (r) => r.name,
    createPermScreen: "masters_departments",
    newPlaceholder: "New department name",
  },
  categories: {
    title: "Categories",
    joinTable: "project_categories",
    joinFk: "category_id",
    masterTable: "worker_categories",
    masterLabel: (r) => r.name,
    createPermScreen: "masters_categories",
    newPlaceholder: "New category name",
  },
};

function AssignmentSection({ projectId, kind }: { projectId: string; kind: Kind }) {
  const cfg = KIND_CONFIG[kind];
  const { canEdit } = usePermissions();
  const canCreate = canEdit(cfg.createPermScreen);
  const canAssign = canEdit("masters_projects");

  const [all, setAll] = useState<Item[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: masters }, { data: joins }] = await Promise.all([
      supabase.from(cfg.masterTable as any).select("*").order(kind === "contractors" ? "company_name" : "name"),
      supabase.from(cfg.joinTable as any).select(cfg.joinFk).eq("project_id", projectId),
    ]);
    setAll((masters || []).map((r: any) => ({ id: r.id, label: cfg.masterLabel(r) })));
    setAssigned(new Set((joins || []).map((j: any) => j[cfg.joinFk])));
  };

  useEffect(() => {
    if (!projectId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggle = async (id: string, checked: boolean) => {
    if (!canAssign) { toast.error("You don't have edit permission on Projects."); return; }
    setBusy(true);
    if (checked) {
      const { error } = await supabase.from(cfg.joinTable as any).insert({ project_id: projectId, [cfg.joinFk]: id } as any);
      if (error) { toast.error(error.message); setBusy(false); return; }
      setAssigned((s) => new Set(s).add(id));
    } else {
      const { error } = await supabase.from(cfg.joinTable as any).delete().eq("project_id", projectId).eq(cfg.joinFk, id);
      if (error) { toast.error(error.message); setBusy(false); return; }
      setAssigned((s) => { const n = new Set(s); n.delete(id); return n; });
    }
    setBusy(false);
  };

  const createAndAssign = async () => {
    const name = newName.trim();
    if (!name) return;
    if (!canCreate) { toast.error(`You don't have edit permission on ${cfg.title}.`); return; }
    setBusy(true);
    const insertRow: any = kind === "contractors" ? { company_name: name } : { name };
    const { data, error } = await supabase.from(cfg.masterTable as any).insert(insertRow).select("id").single();
    if (error || !data) { toast.error(error?.message || "Create failed"); setBusy(false); return; }
    const newId = (data as any).id as string;
    const { error: e2 } = await supabase.from(cfg.joinTable as any).insert({ project_id: projectId, [cfg.joinFk]: newId } as any);
    if (e2) { toast.error(e2.message); setBusy(false); return; }
    setNewName("");
    await load();
    setBusy(false);
    toast.success(`Created and assigned: ${name}`);
  };

  const q = search.toLowerCase();
  const filtered = all.filter((i) => !q || i.label.toLowerCase().includes(q));
  const assignedItems = filtered.filter((i) => assigned.has(i.id));
  const availableItems = filtered.filter((i) => !assigned.has(i.id));
  const hasSearch = q.length > 0;

  const bulkAssign = async () => {
    if (!canAssign) { toast.error("You don't have edit permission on Projects."); return; }
    if (availableItems.length === 0) return;
    setBusy(true);
    const rows = availableItems.map((i) => ({ project_id: projectId, [cfg.joinFk]: i.id }));
    const { error } = await supabase.from(cfg.joinTable as any).insert(rows as any);
    if (error) { toast.error(error.message); setBusy(false); return; }
    setAssigned((s) => { const n = new Set(s); availableItems.forEach((i) => n.add(i.id)); return n; });
    setBusy(false);
    toast.success(`Assigned ${rows.length} ${cfg.title.toLowerCase()}`);
  };

  const bulkUnassign = async () => {
    if (!canAssign) { toast.error("You don't have edit permission on Projects."); return; }
    if (assignedItems.length === 0) return;
    if (!window.confirm(`Unassign ${assignedItems.length} ${cfg.title.toLowerCase()}${hasSearch ? " matching the search" : ""}?`)) return;
    setBusy(true);
    const ids = assignedItems.map((i) => i.id);
    const { error } = await supabase.from(cfg.joinTable as any).delete().eq("project_id", projectId).in(cfg.joinFk, ids);
    if (error) { toast.error(error.message); setBusy(false); return; }
    setAssigned((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    setBusy(false);
    toast.success(`Unassigned ${ids.length} ${cfg.title.toLowerCase()}`);
  };

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Create new {cfg.title.toLowerCase().slice(0, -1)}</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={cfg.newPlaceholder} />
          </div>
          <Button size="sm" onClick={createAndAssign} disabled={busy || !newName.trim()}>
            <Plus className="mr-1 h-4 w-4" />Add & Assign
          </Button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder={`Search ${cfg.title.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Assigned ({assignedItems.length})
            </p>
            {canAssign && assignedItems.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={bulkUnassign} disabled={busy}>
                {hasSearch ? `Unassign all matching (${assignedItems.length})` : `Unassign all (${assignedItems.length})`}
              </Button>
            )}
          </div>
          <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
            {assignedItems.length === 0 && <p className="text-sm text-muted-foreground p-3">None assigned yet.</p>}
            {assignedItems.map((i) => (
              <div key={i.id} className="flex items-center justify-between p-2 text-sm">
                <span>{i.label}</span>
                {canAssign && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle(i.id, false)} disabled={busy}>
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Available ({availableItems.length})
            </p>
            {canAssign && availableItems.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={bulkAssign} disabled={busy}>
                {hasSearch ? `Select all matching (${availableItems.length})` : `Select all (${availableItems.length})`}
              </Button>
            )}
          </div>
          <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
            {availableItems.length === 0 && <p className="text-sm text-muted-foreground p-3">No more available.</p>}
            {availableItems.map((i) => (
              <label key={i.id} className="flex items-center gap-2 p-2 text-sm hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={false}
                  onCheckedChange={(c) => toggle(i.id, !!c)}
                  disabled={busy || !canAssign}
                />
                <span>{i.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectAssignments({ projectId }: { projectId: string }) {
  if (!projectId) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Save the project first to manage assignments.</CardContent></Card>;
  }
  return (
    <Tabs defaultValue="contractors" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="contractors">Contractors</TabsTrigger>
        <TabsTrigger value="departments">Departments</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
      </TabsList>
      <TabsContent value="contractors" className="mt-4"><AssignmentSection projectId={projectId} kind="contractors" /></TabsContent>
      <TabsContent value="departments" className="mt-4"><AssignmentSection projectId={projectId} kind="departments" /></TabsContent>
      <TabsContent value="categories" className="mt-4"><AssignmentSection projectId={projectId} kind="categories" /></TabsContent>
    </Tabs>
  );
}
