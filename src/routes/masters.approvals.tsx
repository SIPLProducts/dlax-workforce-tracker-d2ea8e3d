import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/masters/approvals")({
  component: () => <AuthGuard><Page /></AuthGuard>,
});

type Project = { id: string; name: string; code: string | null };
type UserLite = { user_id: string; login_id: string | null; display_name: string | null };
type Config = {
  project_id: string;
  approval_enabled: boolean;
  l1_user_id: string | null;
  l2_user_id: string | null;
};

function Page() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [projects, setProjects] = useState<Project[]>([]);
  const [pcs, setPcs] = useState<UserLite[]>([]);
  const [pms, setPms] = useState<UserLite[]>([]);
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const [proj, cfg, roles, profiles] = await Promise.all([
        supabase.from("projects").select("id,name,code").order("name"),
        (supabase as any).from("project_approval_config").select("*"),
        supabase.from("user_roles").select("user_id, role").in("role", ["project_coordinator", "project_manager"] as any),
        supabase.from("profiles").select("user_id, login_id, display_name"),
      ]);
      setProjects((proj.data || []) as Project[]);
      const cfgMap: Record<string, Config> = {};
      (cfg.data || []).forEach((c: any) => { cfgMap[c.project_id] = c; });
      setConfigs(cfgMap);
      const profMap = new Map((profiles.data || []).map((p: any) => [p.user_id, p]));
      const pcList: UserLite[] = [];
      const pmList: UserLite[] = [];
      (roles.data || []).forEach((r: any) => {
        const p = profMap.get(r.user_id);
        if (!p) return;
        if (r.role === "project_coordinator") pcList.push(p as UserLite);
        if (r.role === "project_manager") pmList.push(p as UserLite);
      });
      setPcs(pcList);
      setPms(pmList);
      setLoading(false);
    })();
  }, [isAdmin]);

  const update = (pid: string, patch: Partial<Config>) => {
    setConfigs((prev) => {
      const cur = prev[pid] || { project_id: pid, approval_enabled: false, l1_user_id: null, l2_user_id: null };
      return { ...prev, [pid]: { ...cur, ...patch } };
    });
  };

  const save = async (pid: string) => {
    const c = configs[pid] || { project_id: pid, approval_enabled: false, l1_user_id: null, l2_user_id: null };
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
  };

  if (!isAdmin) {
    return <div className="p-8 text-muted-foreground">Admin access required.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Project Approval Settings</h1>
          <p className="text-sm text-muted-foreground">Configure 2-level approval workflow per project</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No projects.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => {
            const c = configs[p.id] || { project_id: p.id, approval_enabled: false, l1_user_id: null, l2_user_id: null };
            return (
              <Card key={p.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {p.code ? `${p.code} — ` : ""}{p.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-4 gap-3 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Approval Workflow</label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={c.approval_enabled}
                        onCheckedChange={(v) => update(p.id, { approval_enabled: v })}
                      />
                      <span className="text-sm">{c.approval_enabled ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Level 1 — Project Coordinator</label>
                    <Select
                      value={c.l1_user_id || ""}
                      onValueChange={(v) => update(p.id, { l1_user_id: v || null })}
                      disabled={!c.approval_enabled}
                    >
                      <SelectTrigger><SelectValue placeholder="Select PC" /></SelectTrigger>
                      <SelectContent>
                        {pcs.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No users with PC role</div>}
                        {pcs.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.display_name || u.login_id || u.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Level 2 — Project Manager</label>
                    <Select
                      value={c.l2_user_id || ""}
                      onValueChange={(v) => update(p.id, { l2_user_id: v || null })}
                      disabled={!c.approval_enabled}
                    >
                      <SelectTrigger><SelectValue placeholder="Select PM" /></SelectTrigger>
                      <SelectContent>
                        {pms.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No users with PM role</div>}
                        {pms.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.display_name || u.login_id || u.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => save(p.id)} disabled={savingId === p.id}>
                    {savingId === p.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
