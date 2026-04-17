import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { APP_SCREENS, type PermissionLevel } from "@/lib/screens";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleId?: string | null; // if null/undefined => create mode
  onSaved: () => void;
};

export function RolePermissionsDialog({ open, onOpenChange, roleId, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<Record<string, PermissionLevel>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    const initial: Record<string, PermissionLevel> = {};
    APP_SCREENS.forEach((s) => (initial[s.key] = "none"));
    setPerms(initial);

    if (roleId) {
      setLoading(true);
      (async () => {
        try {
          const [{ data: role }, { data: rolePerms }] = await Promise.all([
            supabase.from("custom_roles").select("*").eq("id", roleId).maybeSingle(),
            supabase.from("role_screen_permissions").select("*").eq("role_id", roleId),
          ]);
          if (role) {
            setName(role.name);
            setDescription(role.description ?? "");
          }
          const map = { ...initial };
          (rolePerms || []).forEach((p) => {
            map[p.screen_key] = p.permission as PermissionLevel;
          });
          setPerms(map);
        } catch (err: any) {
          toast.error("Failed to load role: " + err.message);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open, roleId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setSaving(true);
    try {
      let id = roleId;
      if (id) {
        const { error } = await supabase
          .from("custom_roles")
          .update({ name: name.trim(), description: description.trim() || null })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("custom_roles")
          .insert({ name: name.trim(), description: description.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }

      // Replace permissions
      await supabase.from("role_screen_permissions").delete().eq("role_id", id!);
      const rows = APP_SCREENS.map((s) => ({
        role_id: id!,
        screen_key: s.key,
        permission: perms[s.key] || "none",
      }));
      const { error: insErr } = await supabase.from("role_screen_permissions").insert(rows);
      if (insErr) throw insErr;

      toast.success(roleId ? "Role updated" : "Role created");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{roleId ? "Edit Role" : "Create New Role"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site Engineer" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Screen Permissions</Label>
              <div className="border rounded-md divide-y">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  <span>Screen</span>
                  <span className="w-12 text-center">None</span>
                  <span className="w-12 text-center">View</span>
                  <span className="w-12 text-center">Edit</span>
                </div>
                {APP_SCREENS.map((s) => (
                  <div key={s.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-2 items-center">
                    <span className="text-sm">{s.label}</span>
                    <RadioGroup
                      value={perms[s.key] || "none"}
                      onValueChange={(v) => setPerms((p) => ({ ...p, [s.key]: v as PermissionLevel }))}
                      className="contents"
                    >
                      <div className="w-12 flex justify-center"><RadioGroupItem value="none" id={`${s.key}-none`} /></div>
                      <div className="w-12 flex justify-center"><RadioGroupItem value="view" id={`${s.key}-view`} /></div>
                      <div className="w-12 flex justify-center"><RadioGroupItem value="edit" id={`${s.key}-edit`} /></div>
                    </RadioGroup>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <strong>None</strong>: hidden · <strong>View</strong>: read-only · <strong>Edit</strong>: full access
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
