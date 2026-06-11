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
import { useServerFn } from "@tanstack/react-start";
import { adminSaveRole } from "@/utils/admin-roles.functions";

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
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const saveRoleFn = useServerFn(adminSaveRole);

  useEffect(() => {
    if (!open) return;
    const lockedId = roleId ?? null;
    setCurrentRoleId(lockedId);
    setName("");
    setDescription("");
    const initial: Record<string, PermissionLevel> = {};
    APP_SCREENS.forEach((s) => (initial[s.key] = "none"));
    setPerms(initial);

    if (lockedId) {
      setLoading(true);
      (async () => {
        try {
          const [{ data: role }, { data: rolePerms }] = await Promise.all([
            supabase.from("custom_roles").select("*").eq("id", lockedId).maybeSingle(),
            supabase.from("role_screen_permissions").select("*").eq("role_id", lockedId),
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
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Role name is required");
      return;
    }
    setSaving(true);
    try {
      const permissions: Record<string, PermissionLevel> = {};
      APP_SCREENS.forEach((s) => {
        permissions[s.key] = perms[s.key] || "none";
      });
      await saveRoleFn({
        data: {
          id: currentRoleId,
          name: trimmed,
          description: description.trim() || null,
          permissions,
        },
      });
      toast.success(currentRoleId ? "Role updated" : "Role created");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.message || "Failed to save role";
      if (/already exists|duplicate key|custom_roles_name_key/i.test(msg)) {
        toast.error(`A role named "${trimmed}" already exists`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentRoleId ? "Edit Role" : "Create New Role"}</DialogTitle>
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
