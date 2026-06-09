import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";

type ContractorForm = {
  contractor_code: string;
  company_name: string;
  contact_person: string;
  phone: string;
  contact_number: string;
  license_number: string;
  work_place: string;
  nature_of_work: string;
};

const EMPTY_CONTRACTOR_FORM: ContractorForm = {
  contractor_code: "",
  company_name: "",
  contact_person: "",
  phone: "",
  contact_number: "",
  license_number: "",
  work_place: "",
  nature_of_work: "",
};

function NewContractorDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<ContractorForm>(EMPTY_CONTRACTOR_FORM);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) setForm(EMPTY_CONTRACTOR_FORM); }, [open]);

  const set = <K extends keyof ContractorForm>(k: K, v: ContractorForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const name = form.company_name.trim();
    const code = form.contractor_code.trim();
    if (!name) { toast.error("Company name is required"); return; }
    if (form.contact_number && !/^\d{10}$/.test(form.contact_number)) {
      toast.error("Contact Number must be exactly 10 digits"); return;
    }
    if (!projectId) { toast.error("Select a project first"); return; }
    setBusy(true);
    try {
      let contractorId: string | null = null;

      if (code) {
        const { data: existingByCode } = await supabase
          .from("contractors")
          .select("id")
          .ilike("contractor_code", code)
          .limit(1)
          .maybeSingle();
        if (existingByCode) contractorId = (existingByCode as any).id;
      }

      if (contractorId) {
        const { data: existingMap } = await supabase
          .from("project_contractors")
          .select("id")
          .eq("project_id", projectId)
          .eq("contractor_id", contractorId)
          .maybeSingle();
        if (existingMap) {
          toast.error(`Contractor ${code || name} is already assigned to this project.`);
          setBusy(false); return;
        }
      } else {
        const { data, error } = await supabase.from("contractors").insert(form).select("id").single();
        if (error) {
          if ((error as any).code === "23505") {
            toast.error(`Contractor code "${code}" already exists. Please use a different code.`);
            setBusy(false); return;
          }
          throw error;
        }
        contractorId = (data as any)?.id;
      }

      if (contractorId) {
        const { error: e2 } = await supabase
          .from("project_contractors")
          .insert({ project_id: projectId, contractor_id: contractorId });
        if (e2) {
          if ((e2 as any).code === "23505") {
            toast.error(`Contractor ${code || name} is already assigned to this project.`);
            setBusy(false); return;
          }
          throw e2;
        }
      }

      toast.success(`Created and assigned: ${name}`);
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Contractor</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>SC Code</Label>
            <Input value={form.contractor_code} onChange={(e) => set("contractor_code", e.target.value)} placeholder="e.g. C-001" />
          </div>
          <div className="space-y-1">
            <Label>Company Name *</Label>
            <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contact Person</Label>
            <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Contact Number</Label>
            <Input
              value={form.contact_number}
              onChange={(e) => set("contact_number", e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
            />
          </div>
          <div className="space-y-1">
            <Label>License Number</Label>
            <Input value={form.license_number} onChange={(e) => set("license_number", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Work Place</Label>
            <Input value={form.work_place} onChange={(e) => set("work_place", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Nature of Work</Label>
            <Input value={form.nature_of_work} onChange={(e) => set("nature_of_work", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy || !form.company_name.trim()}>Save &amp; Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
    masterLabel: (r) => r.contractor_code ? `${r.contractor_code} — ${r.company_name}` : r.company_name,
    createPermScreen: "masters_contractors",
    newPlaceholder: "New contractor company name",
  },
  departments: {
    title: "Departments",
    joinTable: "project_departments",
    joinFk: "department_id",
    masterTable: "departments",
    masterLabel: (r) => r.department_code ? `${r.department_code} — ${r.name}` : r.name,
    createPermScreen: "masters_departments",
    newPlaceholder: "New department name",
  },
  categories: {
    title: "Categories",
    joinTable: "project_categories",
    joinFk: "category_id",
    masterTable: "worker_categories",
    masterLabel: (r) => r.category_code ? `${r.category_code} — ${r.name}` : r.name,
    createPermScreen: "masters_categories",
    newPlaceholder: "New category name",
  },
};

// Auto-assign categories mapped to the given department ids into project_categories.
// Returns the number of new category rows inserted.
async function autoAssignCategoriesForDepartments(
  projectId: string,
  departmentIds: string[],
): Promise<number> {
  if (!projectId || departmentIds.length === 0) return 0;

  const { data: maps } = await supabase
    .from("department_categories")
    .select("category_id")
    .in("department_id", departmentIds);
  const mappedCatIds = Array.from(new Set((maps || []).map((m: any) => m.category_id))).filter(Boolean);
  if (mappedCatIds.length === 0) return 0;

  const { data: existing } = await supabase
    .from("project_categories")
    .select("category_id")
    .eq("project_id", projectId)
    .in("category_id", mappedCatIds);
  const existingSet = new Set((existing || []).map((r: any) => r.category_id));
  const toInsert = mappedCatIds.filter((id) => !existingSet.has(id));
  if (toInsert.length === 0) return 0;

  const rows = toInsert.map((cid) => ({ project_id: projectId, category_id: cid }));
  const { error } = await supabase.from("project_categories").insert(rows as any);
  if (error) {
    toast.error(`Auto-assign categories failed: ${error.message}`);
    return 0;
  }
  return toInsert.length;
}

function AssignmentSection({
  projectId,
  kind,
  refreshKey,
  onCategoriesChanged,
}: {
  projectId: string;
  kind: Kind;
  refreshKey: number;
  onCategoriesChanged: () => void;
}) {
  const cfg = KIND_CONFIG[kind];
  const { canEdit } = usePermissions();
  const isAssignmentsAdmin = canEdit("masters_assignments");
  const canCreate = isAssignmentsAdmin || canEdit(cfg.createPermScreen);
  const canAssign = isAssignmentsAdmin || canEdit("masters_projects");

  const [all, setAll] = useState<Item[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: masters }, { data: joins }, allAssignedRes] = await Promise.all([
      supabase.from(cfg.masterTable as any).select("*").order(kind === "contractors" ? "company_name" : "name"),
      supabase.from(cfg.joinTable as any).select(cfg.joinFk).eq("project_id", projectId),
      kind === "contractors"
        ? supabase.rpc("get_globally_assigned_contractor_ids")
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const assignedHere = new Set((joins || []).map((j: any) => j[cfg.joinFk]));
    // For contractors only: hide any contractor assigned to a different project.
    const assignedElsewhere = kind === "contractors"
      ? new Set(
          ((allAssignedRes as any)?.data || [])
            .map((row: any) => (typeof row === "string" ? row : row?.contractor_id ?? row))
            .filter((id: string) => id && !assignedHere.has(id))
        )
      : new Set<string>();


    const visible = (masters || [])
      .filter((r: any) => assignedHere.has(r.id) || !assignedElsewhere.has(r.id))
      .map((r: any) => ({ id: r.id, label: cfg.masterLabel(r) }));
    setAll(visible);
    setAssigned(assignedHere);
  };


  useEffect(() => {
    if (!projectId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, refreshKey]);

  const toggle = async (id: string, checked: boolean) => {
    if (!canAssign) { toast.error("You don't have edit permission on Projects."); return; }
    setBusy(true);
    if (checked) {
      const { error } = await supabase.from(cfg.joinTable as any).insert({ project_id: projectId, [cfg.joinFk]: id } as any);
      if (error) { toast.error(error.message); setBusy(false); return; }
      setAssigned((s) => new Set(s).add(id));
      if (kind === "departments") {
        const n = await autoAssignCategoriesForDepartments(projectId, [id]);
        if (n > 0) {
          toast.success(`Also auto-assigned ${n} categor${n === 1 ? "y" : "ies"}`);
          onCategoriesChanged();
        }
      }
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
    const insertedIds = availableItems.map((i) => i.id);
    setAssigned((s) => { const n = new Set(s); insertedIds.forEach((id) => n.add(id)); return n; });
    if (kind === "departments") {
      const n = await autoAssignCategoriesForDepartments(projectId, insertedIds);
      if (n > 0) {
        toast.success(`Assigned ${rows.length} departments + ${n} categor${n === 1 ? "y" : "ies"}`);
        onCategoriesChanged();
      } else {
        toast.success(`Assigned ${rows.length} ${cfg.title.toLowerCase()}`);
      }
    } else {
      toast.success(`Assigned ${rows.length} ${cfg.title.toLowerCase()}`);
    }
    setBusy(false);
  };

  const [newContractorOpen, setNewContractorOpen] = useState(false);

  return (

    <div className="space-y-4">
      {kind === "contractors" && canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setNewContractorOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />Add & Assign
          </Button>
          <NewContractorDialog
            projectId={projectId}
            open={newContractorOpen}
            onOpenChange={setNewContractorOpen}
            onCreated={load}
          />
        </div>
      )}
      {kind !== "contractors" && canCreate && (
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
          </div>
          {canAssign && availableItems.length > 0 && (

            <Button variant="outline" size="sm" className="w-full mb-2" onClick={bulkAssign} disabled={busy}>
              {hasSearch ? `Select all matching (${availableItems.length})` : `Select all (${availableItems.length})`}
            </Button>
          )}
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
  const [categoriesVersion, setCategoriesVersion] = useState(0);

  if (!projectId) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Save the project first to manage assignments.</CardContent></Card>;
  }
  const bumpCategories = () => setCategoriesVersion((v) => v + 1);
  return (
    <Tabs defaultValue="contractors" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="contractors">Contractors</TabsTrigger>
        <TabsTrigger value="departments">Departments</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
      </TabsList>
      <TabsContent value="contractors" className="mt-4">
        <AssignmentSection projectId={projectId} kind="contractors" refreshKey={0} onCategoriesChanged={bumpCategories} />
      </TabsContent>
      <TabsContent value="departments" className="mt-4">
        <AssignmentSection projectId={projectId} kind="departments" refreshKey={0} onCategoriesChanged={bumpCategories} />
      </TabsContent>
      <TabsContent value="categories" className="mt-4">
        <AssignmentSection projectId={projectId} kind="categories" refreshKey={categoriesVersion} onCategoriesChanged={bumpCategories} />
      </TabsContent>
    </Tabs>
  );
}
