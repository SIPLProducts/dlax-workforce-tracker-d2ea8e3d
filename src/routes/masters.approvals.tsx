import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Save, ShieldCheck, Plus, Pencil, Trash2, Search, Columns3,
  LayoutGrid, List, ChevronDown, Info, X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/masters/approvals")({
  component: Page,
});

type Project = {
  id: string;
  name: string;
  code: string | null;
  location: string | null;
  division: string | null;
  project_group: string | null;
  start_date: string | null;
  status: string;
  created_at?: string;
};
type UserLite = { user_id: string; login_id: string | null; display_name: string | null; role?: string | null };
type Config = {
  project_id: string;
  approval_enabled: boolean;
  l1_user_id: string | null;
  l2_user_id: string | null;
  updated_at?: string | null;
};

const COLUMN_KEYS = ["code", "name", "status", "approval", "l1", "l2", "updated", "actions"] as const;
type ColKey = typeof COLUMN_KEYS[number];
const DEFAULT_COLS: Record<ColKey, boolean> = {
  code: true, name: true, status: true, approval: true,
  l1: true, l2: true, updated: false, actions: true,
};
const COL_LABELS: Record<ColKey, string> = {
  code: "Code", name: "Name", status: "Status", approval: "Approval Enabled",
  l1: "L1 (PC)", l2: "L2 (PM)", updated: "Last Updated", actions: "Actions",
};

const PREF_KEY = "dlax.approvals.prefs";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(150),
  code: z.string().trim().max(40).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  division: z.string().trim().max(100).optional().or(z.literal("")),
  project_group: z.string().trim().max(100).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  status: z.enum(["Active", "On Hold", "Completed"]),
});

type ProjectForm = z.infer<typeof projectSchema>;
const emptyForm: ProjectForm = { name: "", code: "", location: "", division: "", project_group: "", start_date: "", status: "Active" };

function Page() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [projects, setProjects] = useState<Project[]>([]);
  const [pcs, setPcs] = useState<UserLite[]>([]);
  const [pms, setPms] = useState<UserLite[]>([]);
  const [otherUsers, setOtherUsers] = useState<UserLite[]>([]);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [original, setOriginal] = useState<Record<string, Config>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  // UI state — search/filter/sort
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled" | "no_l1" | "no_l2">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "code" | "recent" | "enabled_first">("name_asc");

  // View prefs (persisted)
  const [view, setView] = useState<"card" | "table">("card");
  const [cols, setCols] = useState<Record<ColKey, boolean>>(DEFAULT_COLS);

  // Selection for bulk actions
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Project dialog
  const [projDialogOpen, setProjDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [savingProject, setSavingProject] = useState(false);

  // Bulk dialog
  const [bulkSetL1Open, setBulkSetL1Open] = useState(false);
  const [bulkSetL2Open, setBulkSetL2Open] = useState(false);
  const [bulkUserPick, setBulkUserPick] = useState<string>("");

  // Load preferences
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.cols) setCols({ ...DEFAULT_COLS, ...p.cols });
        if (p.view === "table" || p.view === "card") setView(p.view);
        if (p.sortBy) setSortBy(p.sortBy);
        if (p.filter) setFilter(p.filter);
      }
    } catch {/* ignore */}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ cols, view, sortBy, filter }));
    } catch {/* ignore */}
  }, [cols, view, sortBy, filter]);

  const loadAll = async () => {
    setLoading(true);
    try {
      setHintDismissed(localStorage.getItem("dlax.approvals.hint.dismissed") === "1");
    } catch {/* ignore */}
    const [proj, cfg, roles, profiles] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      (supabase as any).from("project_approval_config").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profiles").select("user_id, login_id, display_name"),
    ]);
    setProjects((proj.data || []) as Project[]);
    const cfgMap: Record<string, Config> = {};
    (cfg.data || []).forEach((c: any) => { cfgMap[c.project_id] = c; });
    setConfigs(cfgMap);
    setOriginal(JSON.parse(JSON.stringify(cfgMap)));

    // Aggregate roles per user (a user may have multiple)
    const rolesByUser = new Map<string, string[]>();
    (roles.data || []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) || [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    const pcList: UserLite[] = [];
    const pmList: UserLite[] = [];
    const otherList: UserLite[] = [];
    (profiles.data || []).forEach((p: any) => {
      const userRoles = rolesByUser.get(p.user_id) || [];
      const primary = userRoles[0] || null;
      const u: UserLite = { ...p, role: primary };
      if (userRoles.includes("project_coordinator")) pcList.push(u);
      if (userRoles.includes("project_manager")) pmList.push(u);
      if (!userRoles.includes("project_coordinator") && !userRoles.includes("project_manager")) {
        otherList.push(u);
      }
    });
    setPcs(pcList);
    setPms(pmList);
    setOtherUsers(otherList);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  // ---- Helpers ----
  const cfgFor = (pid: string): Config =>
    configs[pid] || { project_id: pid, approval_enabled: false, l1_user_id: null, l2_user_id: null };

  const isDirty = (pid: string) => {
    const a = configs[pid] || { project_id: pid, approval_enabled: false, l1_user_id: null, l2_user_id: null };
    const b = original[pid] || { project_id: pid, approval_enabled: false, l1_user_id: null, l2_user_id: null };
    return a.approval_enabled !== b.approval_enabled || a.l1_user_id !== b.l1_user_id || a.l2_user_id !== b.l2_user_id;
  };

  const dirtyCount = useMemo(() => projects.filter((p) => isDirty(p.id)).length, [projects, configs, original]);

  const update = (pid: string, patch: Partial<Config>) => {
    setConfigs((prev) => {
      const cur = prev[pid] || { project_id: pid, approval_enabled: false, l1_user_id: null, l2_user_id: null };
      return { ...prev, [pid]: { ...cur, ...patch } };
    });
  };

  const saveOne = async (pid: string) => {
    const c = cfgFor(pid);
    setSavingId(pid);
    const { error } = await (supabase as any).from("project_approval_config").upsert({
      project_id: pid,
      approval_enabled: c.approval_enabled,
      l1_user_id: c.l1_user_id,
      l2_user_id: c.l2_user_id,
    }, { onConflict: "project_id" });
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOriginal((prev) => ({ ...prev, [pid]: { ...c } }));
  };

  const saveAllChanged = async () => {
    const dirty = projects.filter((p) => isDirty(p.id));
    if (dirty.length === 0) return toast.info("No changes");
    setSavingAll(true);
    const rows = dirty.map((p) => {
      const c = cfgFor(p.id);
      return {
        project_id: p.id,
        approval_enabled: c.approval_enabled,
        l1_user_id: c.l1_user_id,
        l2_user_id: c.l2_user_id,
      };
    });
    const { error } = await (supabase as any).from("project_approval_config").upsert(rows, { onConflict: "project_id" });
    setSavingAll(false);
    if (error) return toast.error(error.message);
    toast.success(`Saved ${dirty.length} project${dirty.length > 1 ? "s" : ""}`);
    const next = { ...original };
    dirty.forEach((p) => { next[p.id] = { ...cfgFor(p.id) }; });
    setOriginal(next);
  };

  // ---- Project CRUD ----
  const openAddProject = () => {
    setEditingProjectId(null);
    setForm(emptyForm);
    setProjDialogOpen(true);
  };
  const openEditProject = (p: Project) => {
    setEditingProjectId(p.id);
    setForm({
      name: p.name,
      code: p.code || "",
      location: p.location || "",
      division: p.division || "",
      project_group: p.project_group || "",
      start_date: p.start_date || "",
      status: (p.status as ProjectForm["status"]) || "Active",
    });
    setProjDialogOpen(true);
  };

  const submitProject = async () => {
    const parsed = projectSchema.safeParse(form);
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0]?.message || "Invalid input");
    }
    const payload: any = {
      name: parsed.data.name,
      code: parsed.data.code || null,
      location: parsed.data.location || null,
      division: parsed.data.division || null,
      project_group: parsed.data.project_group || null,
      start_date: parsed.data.start_date || null,
      status: parsed.data.status,
    };
    setSavingProject(true);
    if (editingProjectId) {
      const { error } = await supabase.from("projects").update(payload).eq("id", editingProjectId);
      setSavingProject(false);
      if (error) return toast.error(error.message);
      toast.success("Project updated");
    } else {
      const { error } = await supabase.from("projects").insert(payload);
      setSavingProject(false);
      if (error) return toast.error(error.message);
      toast.success("Project added");
    }
    setProjDialogOpen(false);
    loadAll();
  };

  const deleteProject = async (p: Project) => {
    const { count } = await supabase
      .from("daily_manpower")
      .select("id", { count: "exact", head: true })
      .eq("project_id", p.id);
    if ((count || 0) > 0) {
      return toast.error(`Cannot delete: ${count} daily entry record(s) exist for this project`);
    }
    if (!confirm(`Delete project "${p.name}"?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    loadAll();
  };

  // ---- Filtering / Sorting ----
  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q))) return false;
      const c = cfgFor(p.id);
      if (filter === "enabled" && !c.approval_enabled) return false;
      if (filter === "disabled" && c.approval_enabled) return false;
      if (filter === "no_l1" && (!c.approval_enabled || !!c.l1_user_id)) return false;
      if (filter === "no_l2" && (!c.approval_enabled || !!c.l2_user_id)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name_desc": return b.name.localeCompare(a.name);
        case "code": return (a.code || "").localeCompare(b.code || "");
        case "recent": return (b.created_at || "").localeCompare(a.created_at || "");
        case "enabled_first": {
          const ea = cfgFor(a.id).approval_enabled ? 1 : 0;
          const eb = cfgFor(b.id).approval_enabled ? 1 : 0;
          if (ea !== eb) return eb - ea;
          return a.name.localeCompare(b.name);
        }
        default: return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [projects, configs, search, filter, sortBy]);

  // ---- Selection ----
  const allSelected = visibleProjects.length > 0 && visibleProjects.every((p) => selected.has(p.id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const n = new Set(prev);
        visibleProjects.forEach((p) => n.delete(p.id));
        return n;
      }
      const n = new Set(prev);
      visibleProjects.forEach((p) => n.add(p.id));
      return n;
    });
  };
  const toggleOne = (pid: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(pid) ? n.delete(pid) : n.add(pid);
      return n;
    });
  };

  // ---- Bulk actions ----
  const bulkApply = (patch: Partial<Config>) => {
    if (selected.size === 0) return;
    setConfigs((prev) => {
      const next = { ...prev };
      selected.forEach((pid) => {
        const cur = next[pid] || { project_id: pid, approval_enabled: false, l1_user_id: null, l2_user_id: null };
        next[pid] = { ...cur, ...patch };
      });
      return next;
    });
    toast.success(`Applied to ${selected.size} project${selected.size > 1 ? "s" : ""} — click "Save All" to persist`);
  };

  if (!isAdmin) {
    return <div className="p-8 text-muted-foreground">Admin access required.</div>;
  }

  const labelFor = (u: UserLite) => {
    const name = u.display_name || u.login_id || u.user_id.slice(0, 8);
    const lid = u.login_id ? ` (${u.login_id})` : "";
    const role = u.role ? ` — ${u.role.replace(/_/g, " ")}` : "";
    return `${name}${lid}${role}`;
  };

  const renderUserSelectContent = (level: "l1" | "l2") => {
    const primary = level === "l1" ? pcs : pms;
    const primaryLabel = level === "l1" ? "Project Coordinators" : "Project Managers";
    const totalUsers = pcs.length + pms.length + otherUsers.length;
    if (totalUsers === 0) {
      return (
        <SelectContent>
          <div className="px-2 py-2 text-xs text-muted-foreground">
            No users found.{" "}
            <Link to="/users" className="text-primary underline">Add users</Link>
          </div>
        </SelectContent>
      );
    }
    return (
      <SelectContent className="max-h-[320px]">
        <SelectItem value="__none__">— None —</SelectItem>
        {primary.length === 0 && (
          <div className="px-2 py-2 text-xs text-muted-foreground border-b">
            No {primaryLabel} assigned.{" "}
            <Link to="/users" className="text-primary underline">Assign role</Link>
          </div>
        )}
        {primary.length > 0 && (
          <>
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground">{primaryLabel}</div>
            {primary.map((u) => (
              <SelectItem key={`p-${u.user_id}`} value={u.user_id}>{labelFor(u)}</SelectItem>
            ))}
          </>
        )}
        {otherUsers.length > 0 && (
          <>
            <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase text-muted-foreground border-t mt-1">Other users</div>
            {otherUsers.map((u) => (
              <SelectItem key={`o-${u.user_id}`} value={u.user_id}>{labelFor(u)}</SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    );
  };

  const handleUserChange = (pid: string, level: "l1" | "l2", v: string) => {
    const val = v === "__none__" ? null : v;
    update(pid, level === "l1" ? { l1_user_id: val } : { l2_user_id: val });
  };

  const showRoleHint = !hintDismissed && (pcs.length === 0 || pms.length === 0);
  const dismissHint = () => {
    setHintDismissed(true);
    try { localStorage.setItem("dlax.approvals.hint.dismissed", "1"); } catch {/* ignore */}
  };

  // ---- Reusable row content (for card view) ----
  const renderCard = (p: Project) => {
    const c = cfgFor(p.id);
    const dirty = isDirty(p.id);
    return (
      <Card key={p.id} className={dirty ? "border-amber-400" : ""}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {p.code ? <span className="text-muted-foreground mr-1">{p.code} —</span> : null}
                {p.name}
              </CardTitle>
              <div className="text-xs text-muted-foreground flex gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                {p.location && <span>📍 {p.location}</span>}
                {dirty && <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">● Modified</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => openEditProject(p)} title="Edit project">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => deleteProject(p)} title="Delete project">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3 items-end">
          <div className="space-y-2">
            <label className="text-xs font-medium">Approval Workflow</label>
            <div className="flex items-center gap-2 h-10">
              <Switch checked={c.approval_enabled} onCheckedChange={(v) => update(p.id, { approval_enabled: v })} />
              <span className="text-sm">{c.approval_enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">L1 — Project Coordinator</label>
            <Select
              value={c.l1_user_id || ""}
              onValueChange={(v) => handleUserChange(p.id, "l1", v)}
              disabled={!c.approval_enabled}
            >
              <SelectTrigger><SelectValue placeholder="Select Project Coordinator" /></SelectTrigger>
              {renderUserSelectContent("l1")}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">L2 — Project Manager</label>
            <Select
              value={c.l2_user_id || ""}
              onValueChange={(v) => handleUserChange(p.id, "l2", v)}
              disabled={!c.approval_enabled}
            >
              <SelectTrigger><SelectValue placeholder="Select Project Manager" /></SelectTrigger>
              {renderUserSelectContent("l2")}
            </Select>
          </div>
          <Button onClick={() => saveOne(p.id)} disabled={savingId === p.id || !dirty} variant={dirty ? "default" : "outline"}>
            {savingId === p.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </CardContent>
      </Card>
    );
  };

  // ---- Table view ----
  const renderTable = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              {cols.code && <TableHead>Code</TableHead>}
              {cols.name && <TableHead>Name</TableHead>}
              {cols.status && <TableHead>Status</TableHead>}
              {cols.approval && <TableHead>Approval</TableHead>}
              {cols.l1 && <TableHead>L1 (PC)</TableHead>}
              {cols.l2 && <TableHead>L2 (PM)</TableHead>}
              {cols.updated && <TableHead>Updated</TableHead>}
              {cols.actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleProjects.length === 0 && (
              <TableRow>
                <TableCell colSpan={Object.values(cols).filter(Boolean).length + 1} className="text-center py-8 text-muted-foreground">
                  No projects match the filters.
                </TableCell>
              </TableRow>
            )}
            {visibleProjects.map((p) => {
              const c = cfgFor(p.id);
              const dirty = isDirty(p.id);
              return (
                <TableRow key={p.id} className={dirty ? "bg-amber-50/40" : ""}>
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                  </TableCell>
                  {cols.code && <TableCell className="font-mono text-xs">{p.code || "—"}</TableCell>}
                  {cols.name && (
                    <TableCell className="font-medium">
                      {p.name}
                      {dirty && <span className="ml-2 text-amber-600 text-xs">● Modified</span>}
                    </TableCell>
                  )}
                  {cols.status && <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>}
                  {cols.approval && (
                    <TableCell>
                      <Switch checked={c.approval_enabled} onCheckedChange={(v) => update(p.id, { approval_enabled: v })} />
                    </TableCell>
                  )}
                  {cols.l1 && (
                    <TableCell>
                      <Select
                        value={c.l1_user_id || ""}
                        onValueChange={(v) => handleUserChange(p.id, "l1", v)}
                        disabled={!c.approval_enabled}
                      >
                        <SelectTrigger className="h-8 min-w-[180px]"><SelectValue placeholder="Select PC" /></SelectTrigger>
                        {renderUserSelectContent("l1")}
                      </Select>
                    </TableCell>
                  )}
                  {cols.l2 && (
                    <TableCell>
                      <Select
                        value={c.l2_user_id || ""}
                        onValueChange={(v) => handleUserChange(p.id, "l2", v)}
                        disabled={!c.approval_enabled}
                      >
                        <SelectTrigger className="h-8 min-w-[180px]"><SelectValue placeholder="Select PM" /></SelectTrigger>
                        {renderUserSelectContent("l2")}
                      </Select>
                    </TableCell>
                  )}
                  {cols.updated && (
                    <TableCell className="text-xs text-muted-foreground">
                      {c.updated_at ? format(new Date(c.updated_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                  )}
                  {cols.actions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant={dirty ? "default" : "outline"} onClick={() => saveOne(p.id)} disabled={savingId === p.id || !dirty}>
                          {savingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEditProject(p)} title="Edit project">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteProject(p)} title="Delete project">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Project Approval Settings</h1>
            <p className="text-sm text-muted-foreground">Configure 2-level approval per project</p>
          </div>
        </div>
        <div className="flex gap-2">
          {dirtyCount > 0 && (
            <Button onClick={saveAllChanged} disabled={savingAll}>
              {savingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save All Changed ({dirtyCount})
            </Button>
          )}
          <Button onClick={openAddProject}>
            <Plus className="w-4 h-4 mr-2" /> Add Project
          </Button>
        </div>
      </div>

      {showRoleHint && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            Tip: Assign the <strong>Project Coordinator</strong> and <strong>Project Manager</strong> roles to users in{" "}
            <Link to="/users" className="underline font-medium">User Management</Link> so they appear in the L1/L2 lists.
            {pcs.length === 0 && <span className="block text-xs mt-1">• No Project Coordinators yet.</span>}
            {pms.length === 0 && <span className="block text-xs">• No Project Managers yet.</span>}
            <span className="block text-xs mt-1 opacity-80">In the meantime, any user can be picked from the "Other users" group.</span>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={dismissHint}><X className="w-4 h-4" /></Button>
        </div>
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              className="pl-8"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="enabled">Approval enabled</SelectItem>
              <SelectItem value="disabled">Approval disabled</SelectItem>
              <SelectItem value="no_l1">Missing L1</SelectItem>
              <SelectItem value="no_l2">Missing L2</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name A → Z</SelectItem>
              <SelectItem value="name_desc">Name Z → A</SelectItem>
              <SelectItem value="code">Code</SelectItem>
              <SelectItem value="recent">Recently added</SelectItem>
              <SelectItem value="enabled_first">Approval-enabled first</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Columns3 className="w-4 h-4 mr-2" />Columns<ChevronDown className="w-4 h-4 ml-1" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_KEYS.map((k) => (
                <DropdownMenuCheckboxItem
                  key={k}
                  checked={cols[k]}
                  onCheckedChange={(v) => setCols((prev) => ({ ...prev, [k]: !!v }))}
                >
                  {COL_LABELS[k]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex border rounded-md overflow-hidden">
            <Button variant={view === "card" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setView("card")}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setView("table")}>
              <List className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card className="border-primary">
          <CardContent className="p-3 flex flex-wrap gap-2 items-center">
            <Badge>{selected.size} selected</Badge>
            <Button size="sm" variant="outline" onClick={() => bulkApply({ approval_enabled: true })}>Enable approval</Button>
            <Button size="sm" variant="outline" onClick={() => bulkApply({ approval_enabled: false })}>Disable approval</Button>
            <Button size="sm" variant="outline" onClick={() => { setBulkUserPick(""); setBulkSetL1Open(true); }}>Set L1…</Button>
            <Button size="sm" variant="outline" onClick={() => { setBulkUserPick(""); setBulkSetL2Open(true); }}>Set L2…</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            <span className="text-xs text-muted-foreground ml-auto">Changes are staged — click Save All Changed to persist</span>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No projects yet. Click "Add Project" to create one.</CardContent></Card>
      ) : view === "table" ? (
        renderTable()
      ) : (
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
            <span className="text-muted-foreground">Select all visible ({visibleProjects.length})</span>
          </div>
          {visibleProjects.map(renderCard)}
          {visibleProjects.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No projects match the filters.</CardContent></Card>
          )}
        </div>
      )}

      {/* Project add/edit dialog */}
      <Dialog open={projDialogOpen} onOpenChange={setProjDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingProjectId ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProjectForm["status"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Division</Label>
              <Input value={form.division} onChange={(e) => setForm((f) => ({ ...f, division: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Project Group</Label>
              <Input value={form.project_group} onChange={(e) => setForm((f) => ({ ...f, project_group: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitProject} disabled={savingProject}>
              {savingProject ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingProjectId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Set L1/L2 */}
      <Dialog open={bulkSetL1Open} onOpenChange={setBulkSetL1Open}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set L1 (Project Coordinator) for {selected.size} project(s)</DialogTitle></DialogHeader>
          <Select value={bulkUserPick} onValueChange={setBulkUserPick}>
            <SelectTrigger><SelectValue placeholder="Select Project Coordinator" /></SelectTrigger>
            {renderUserSelectContent("l1")}
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkSetL1Open(false)}>Cancel</Button>
            <Button onClick={() => { const v = bulkUserPick === "__none__" ? null : (bulkUserPick || null); bulkApply({ l1_user_id: v, approval_enabled: true }); setBulkSetL1Open(false); }} disabled={!bulkUserPick}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkSetL2Open} onOpenChange={setBulkSetL2Open}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set L2 (Project Manager) for {selected.size} project(s)</DialogTitle></DialogHeader>
          <Select value={bulkUserPick} onValueChange={setBulkUserPick}>
            <SelectTrigger><SelectValue placeholder="Select Project Manager" /></SelectTrigger>
            {renderUserSelectContent("l2")}
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkSetL2Open(false)}>Cancel</Button>
            <Button onClick={() => { const v = bulkUserPick === "__none__" ? null : (bulkUserPick || null); bulkApply({ l2_user_id: v, approval_enabled: true }); setBulkSetL2Open(false); }} disabled={!bulkUserPick}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
