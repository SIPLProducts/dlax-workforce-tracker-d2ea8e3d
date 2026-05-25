import { ScreenGuard } from "@/components/ScreenGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
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
  Loader2, Save, ShieldCheck, Plus, Pencil, Trash2, Search,
  LayoutGrid, List, ArrowUp, ArrowDown, X, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/masters/approvals")({
  component: () => <ScreenGuard screen="masters_approval_config"><Page /></ScreenGuard>,
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
type UserLite = { user_id: string; login_id: string | null; display_name: string | null };
type Level = { level_no: number; label: string; approver_user_id: string | null };

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

const sortLevels = (arr: Level[]): Level[] =>
  [...arr].sort((a, b) => a.level_no - b.level_no).map((l, i) => ({ ...l, level_no: i + 1 }));

function Page() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { canEdit } = usePermissions();
  const canManageApprovals = isAdmin || canEdit("masters_approval_config");

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [originalEnabled, setOriginalEnabled] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Record<string, Level[]>>({});
  const [originalLevels, setOriginalLevels] = useState<Record<string, Level[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled" | "no_approvers">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "code" | "recent" | "enabled_first">("name_asc");
  const [view, setView] = useState<"card" | "table">("card");

  const [projDialogOpen, setProjDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [savingProject, setSavingProject] = useState(false);

  // Levels editor dialog (table view)
  const [levelsDialogProject, setLevelsDialogProject] = useState<Project | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.view === "table" || p.view === "card") setView(p.view);
        if (p.sortBy) setSortBy(p.sortBy);
        if (p.filter) setFilter(p.filter);
      }
    } catch {/* ignore */}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ view, sortBy, filter })); } catch {/* ignore */}
  }, [view, sortBy, filter]);

  const loadAll = async () => {
    setLoading(true);
    const [proj, cfg, lvls, profiles] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      (supabase as any).from("project_approval_config").select("project_id, approval_enabled"),
      (supabase as any).from("project_approval_levels").select("project_id, level_no, label, approver_user_id").order("level_no"),
      supabase.from("profiles").select("user_id, login_id, display_name").order("display_name"),
    ]);
    setProjects((proj.data || []) as Project[]);
    setUsers((profiles.data || []) as UserLite[]);

    const en: Record<string, boolean> = {};
    (cfg.data || []).forEach((c: any) => { en[c.project_id] = !!c.approval_enabled; });
    setEnabled(en);
    setOriginalEnabled({ ...en });

    const lv: Record<string, Level[]> = {};
    (lvls.data || []).forEach((r: any) => {
      const arr = lv[r.project_id] || [];
      arr.push({ level_no: r.level_no, label: r.label || "", approver_user_id: r.approver_user_id });
      lv[r.project_id] = arr;
    });
    Object.keys(lv).forEach((k) => { lv[k] = sortLevels(lv[k]); });
    setLevels(lv);
    setOriginalLevels(JSON.parse(JSON.stringify(lv)));
    setLoading(false);
  };

  useEffect(() => { if (canManageApprovals) loadAll(); }, [canManageApprovals]);

  // ---- Helpers ----
  const userLabel = (uid: string | null) => {
    if (!uid) return "—";
    const u = users.find((x) => x.user_id === uid);
    if (!u) return uid.slice(0, 8);
    const name = u.display_name || u.login_id || u.user_id.slice(0, 8);
    return u.login_id ? `${name} (${u.login_id})` : name;
  };

  const levelsFor = (pid: string): Level[] => levels[pid] || [];

  const isDirty = (pid: string) => {
    if ((enabled[pid] || false) !== (originalEnabled[pid] || false)) return true;
    const a = levelsFor(pid);
    const b = originalLevels[pid] || [];
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i].level_no !== b[i].level_no || a[i].label !== b[i].label || a[i].approver_user_id !== b[i].approver_user_id) return true;
    }
    return false;
  };

  const dirtyCount = useMemo(() => projects.filter((p) => isDirty(p.id)).length, [projects, enabled, originalEnabled, levels, originalLevels]);

  const setEnabledFor = (pid: string, v: boolean) => setEnabled((prev) => ({ ...prev, [pid]: v }));

  const addLevel = (pid: string) => {
    setLevels((prev) => {
      const cur = prev[pid] || [];
      const nextNo = cur.length + 1;
      return { ...prev, [pid]: [...cur, { level_no: nextNo, label: `Level ${nextNo}`, approver_user_id: null }] };
    });
  };
  const updateLevel = (pid: string, idx: number, patch: Partial<Level>) => {
    setLevels((prev) => {
      const cur = [...(prev[pid] || [])];
      cur[idx] = { ...cur[idx], ...patch };
      return { ...prev, [pid]: cur };
    });
  };
  const removeLevel = (pid: string, idx: number) => {
    setLevels((prev) => {
      const cur = [...(prev[pid] || [])];
      cur.splice(idx, 1);
      return { ...prev, [pid]: sortLevels(cur) };
    });
  };
  const moveLevel = (pid: string, idx: number, dir: -1 | 1) => {
    setLevels((prev) => {
      const cur = [...(prev[pid] || [])];
      const j = idx + dir;
      if (j < 0 || j >= cur.length) return prev;
      [cur[idx], cur[j]] = [cur[j], cur[idx]];
      return { ...prev, [pid]: sortLevels(cur) };
    });
  };

  const saveOne = async (pid: string) => {
    const lvls = levelsFor(pid);
    const en = enabled[pid] || false;
    if (en && lvls.length > 0 && lvls.some((l) => !l.approver_user_id)) {
      return toast.error("Every level must have an approver");
    }
    setSavingId(pid);
    try {
      const cfgRes = await (supabase as any).from("project_approval_config").upsert(
        { project_id: pid, approval_enabled: en },
        { onConflict: "project_id" }
      );
      if (cfgRes.error) throw cfgRes.error;

      const delRes = await (supabase as any).from("project_approval_levels").delete().eq("project_id", pid);
      if (delRes.error) throw delRes.error;

      if (lvls.length > 0) {
        const rows = lvls.map((l) => ({
          project_id: pid,
          level_no: l.level_no,
          label: l.label || `Level ${l.level_no}`,
          approver_user_id: l.approver_user_id,
        }));
        const insRes = await (supabase as any).from("project_approval_levels").insert(rows);
        if (insRes.error) throw insRes.error;
      }

      setOriginalEnabled((prev) => ({ ...prev, [pid]: en }));
      setOriginalLevels((prev) => ({ ...prev, [pid]: JSON.parse(JSON.stringify(lvls)) }));
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  // ---- Project CRUD ----
  const openAddProject = () => { setEditingProjectId(null); setForm(emptyForm); setProjDialogOpen(true); };
  const openEditProject = (p: Project) => {
    setEditingProjectId(p.id);
    setForm({
      name: p.name, code: p.code || "", location: p.location || "",
      division: p.division || "", project_group: p.project_group || "",
      start_date: p.start_date || "", status: (p.status as ProjectForm["status"]) || "Active",
    });
    setProjDialogOpen(true);
  };
  const submitProject = async () => {
    const parsed = projectSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message || "Invalid input");
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
    const res = editingProjectId
      ? await supabase.from("projects").update(payload).eq("id", editingProjectId)
      : await supabase.from("projects").insert(payload);
    setSavingProject(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editingProjectId ? "Project updated" : "Project added");
    setProjDialogOpen(false);
    loadAll();
  };
  const deleteProject = async (p: Project) => {
    const { count } = await supabase.from("daily_manpower").select("id", { count: "exact", head: true }).eq("project_id", p.id);
    if ((count || 0) > 0) return toast.error(`Cannot delete: ${count} daily entry record(s) exist for this project`);
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
      const en = enabled[p.id] || false;
      const lvls = levelsFor(p.id);
      if (filter === "enabled" && !en) return false;
      if (filter === "disabled" && en) return false;
      if (filter === "no_approvers" && !(en && lvls.length === 0)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name_desc": return b.name.localeCompare(a.name);
        case "code": return (a.code || "").localeCompare(b.code || "");
        case "recent": return (b.created_at || "").localeCompare(a.created_at || "");
        case "enabled_first": {
          const ea = enabled[a.id] ? 1 : 0;
          const eb = enabled[b.id] ? 1 : 0;
          if (ea !== eb) return eb - ea;
          return a.name.localeCompare(b.name);
        }
        default: return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [projects, enabled, levels, search, filter, sortBy]);

  if (!canManageApprovals) {
    return <div className="p-8 text-muted-foreground">You don't have permission to access this page.</div>;
  }

  // ---- Reusable level editor ----
  const renderLevelsEditor = (pid: string) => {
    const lvls = levelsFor(pid);
    const en = enabled[pid] || false;
    if (users.length === 0) {
      return (
        <div className="text-xs text-muted-foreground border rounded-md p-3">
          No users found. <Link to="/users" className="text-primary underline">Add users</Link> first.
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {lvls.length === 0 && (
          <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3 text-center">
            No approval levels configured. Click <strong>+ Add Level</strong> to add the first approver.
          </div>
        )}
        {lvls.map((l, idx) => (
          <div key={`${pid}-${idx}`} className="flex items-center gap-2 border rounded-md p-2 bg-muted/30">
            <Badge variant="secondary" className="shrink-0">L{l.level_no}</Badge>
            <Input
              className="h-8 max-w-[180px]"
              placeholder={`Level ${l.level_no} label`}
              value={l.label}
              disabled={!en}
              onChange={(e) => updateLevel(pid, idx, { label: e.target.value })}
            />
            <Select
              value={l.approver_user_id || ""}
              disabled={!en}
              onValueChange={(v) => updateLevel(pid, idx, { approver_user_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger className="h-8 flex-1 min-w-[200px]">
                <SelectValue placeholder="Select approver" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="__none__">— None —</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{userLabel(u.user_id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" disabled={!en || idx === 0} onClick={() => moveLevel(pid, idx, -1)} title="Move up">
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" disabled={!en || idx === lvls.length - 1} onClick={() => moveLevel(pid, idx, 1)} title="Move down">
              <ArrowDown className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" disabled={!en} onClick={() => removeLevel(pid, idx)} title="Remove level">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" disabled={!en} onClick={() => addLevel(pid)}>
          <Plus className="w-4 h-4 mr-1" /> Add Level
        </Button>
      </div>
    );
  };

  // ---- Card ----
  const renderCard = (p: Project) => {
    const en = enabled[p.id] || false;
    const dirty = isDirty(p.id);
    return (
      <Card key={p.id} className={dirty ? "border-amber-400" : ""}>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
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
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 mr-2">
              <Switch checked={en} onCheckedChange={(v) => setEnabledFor(p.id, v)} />
              <span className="text-sm">{en ? "Approval Enabled" : "Disabled"}</span>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEditProject(p)} title="Edit project">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => deleteProject(p)} title="Delete project">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderLevelsEditor(p.id)}
          <div className="flex justify-end">
            <Button onClick={() => saveOne(p.id)} disabled={savingId === p.id || !dirty} variant={dirty ? "default" : "outline"}>
              {savingId === p.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---- Table ----
  const renderTable = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Approvers (chain)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleProjects.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No projects match the filters.</TableCell></TableRow>
            )}
            {visibleProjects.map((p) => {
              const en = enabled[p.id] || false;
              const lvls = levelsFor(p.id);
              const dirty = isDirty(p.id);
              const chain = lvls.length === 0
                ? <span className="text-muted-foreground text-xs italic">No levels</span>
                : lvls.map((l) => `L${l.level_no}: ${userLabel(l.approver_user_id)}`).join(" → ");
              return (
                <TableRow key={p.id} className={dirty ? "bg-amber-50/40" : ""}>
                  <TableCell className="font-mono text-xs">{p.code || "—"}</TableCell>
                  <TableCell className="font-medium">
                    {p.name}
                    {dirty && <span className="ml-2 text-amber-600 text-xs">● Modified</span>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                  <TableCell><Switch checked={en} onCheckedChange={(v) => setEnabledFor(p.id, v)} /></TableCell>
                  <TableCell className="text-xs max-w-[400px] truncate" title={typeof chain === "string" ? chain : ""}>{chain}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setLevelsDialogProject(p)}>
                        <Settings2 className="w-4 h-4 mr-1" /> Edit Levels
                      </Button>
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Project Approval Settings"
        subtitle="Configure multi-level sequential approval per project"
        icon={<ShieldCheck className="w-6 h-6 text-primary" />}
        actions={
          <>
            {dirtyCount > 0 && (
              <Badge variant="outline" className="border-amber-400 text-amber-700 self-center">
                {dirtyCount} unsaved
              </Badge>
            )}
            <Button onClick={openAddProject}>
              <Plus className="w-4 h-4 mr-2" /> Add Project
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…" className="pl-8" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="enabled">Approval enabled</SelectItem>
              <SelectItem value="disabled">Approval disabled</SelectItem>
              <SelectItem value="no_approvers">Enabled but no levels</SelectItem>
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

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No projects yet. Click "Add Project" to create one.</CardContent></Card>
      ) : view === "table" ? (
        renderTable()
      ) : (
        <div className="grid gap-3">
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

      {/* Levels editor dialog (used from table view) */}
      <Dialog open={!!levelsDialogProject} onOpenChange={(o) => !o && setLevelsDialogProject(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Approval Levels — {levelsDialogProject?.name}
            </DialogTitle>
          </DialogHeader>
          {levelsDialogProject && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={enabled[levelsDialogProject.id] || false}
                  onCheckedChange={(v) => setEnabledFor(levelsDialogProject.id, v)}
                />
                <span className="text-sm">
                  {enabled[levelsDialogProject.id] ? "Approval Enabled" : "Approval Disabled"}
                </span>
              </div>
              {renderLevelsEditor(levelsDialogProject.id)}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelsDialogProject(null)}>Close</Button>
            <Button
              onClick={async () => {
                if (levelsDialogProject) {
                  await saveOne(levelsDialogProject.id);
                  setLevelsDialogProject(null);
                }
              }}
              disabled={!levelsDialogProject || !isDirty(levelsDialogProject.id) || savingId === levelsDialogProject?.id}
            >
              {savingId === levelsDialogProject?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
