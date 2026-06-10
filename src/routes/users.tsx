import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Trash2, Loader2, Plus, Pencil, Key, X, FolderKanban, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { RolePermissionsDialog } from "@/components/RolePermissionsDialog";
import { APP_SCREENS } from "@/lib/screens";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminDeleteUser, adminUpdateUser } from "@/utils/admin-users.functions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScreenGuard } from "@/components/ScreenGuard";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/PageHeader";
import { useHighlightRow } from "@/hooks/use-highlight-row";

export const Route = createFileRoute("/users")({
  component: () => <ScreenGuard screen="user_management"><UsersPage /></ScreenGuard>,
});

type UserWithRoles = {
  user_id: string;
  email: string | null;
  login_id: string | null;
  display_name: string | null;
  roles: string[];
  custom_role_ids: string[];
  project_ids: string[];
  created_at: string;
};

type ProjectLite = { id: string; name: string; code: string | null };

type CustomRole = {
  id: string;
  name: string;
  description: string | null;
};

type RolePerm = { role_id: string; screen_key: string; permission: string };



function UsersPage() {
  const { hasRole, user: currentUser } = useAuth();
  const [deleteTarget, setDeleteTarget] = useState<UserWithRoles | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteUserFn = useServerFn(adminDeleteUser);
  const updateUserFn = useServerFn(adminUpdateUser);

  const [editTarget, setEditTarget] = useState<UserWithRoles | null>(null);
  const [editLoginId, setEditLoginId] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (u: UserWithRoles) => {
    setEditTarget(u);
    setEditLoginId(u.login_id || "");
    setEditDisplayName(u.display_name || "");
    setEditPassword("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const trimmedName = editDisplayName.trim();
    const trimmedLogin = editLoginId.trim().toLowerCase();
    const newPwd = editPassword.trim();
    const loginChanged = trimmedLogin !== (editTarget.login_id || "").toLowerCase();
    const nameChanged = trimmedName !== (editTarget.display_name || "");
    if (!loginChanged && !nameChanged && !newPwd) {
      toast.info("No changes to save");
      return;
    }
    if (loginChanged && !/^[a-z0-9._-]{2,40}$/.test(trimmedLogin)) {
      toast.error("User ID: 2-40 chars, letters, numbers, . _ - only");
      return;
    }
    if (newPwd && newPwd.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSavingEdit(true);
    try {
      await updateUserFn({
        data: {
          userId: editTarget.user_id,
          ...(nameChanged ? { displayName: trimmedName } : {}),
          ...(loginChanged ? { loginId: trimmedLogin } : {}),
          ...(newPwd ? { password: newPwd } : {}),
        },
      });
      toast.success("User updated");
      setEditTarget(null);
      setEditPassword("");
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUserFn({ data: { userId: deleteTarget.user_id } });
      toast.success(`Deleted user "${deleteTarget.login_id || deleteTarget.email}"`);
      setDeleteTarget(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  
  const [customAssignOpen, setCustomAssignOpen] = useState(false);
  const [projectsAssignOpen, setProjectsAssignOpen] = useState(false);
  const [projectsAssignSelection, setProjectsAssignSelection] = useState<Set<string>>(new Set());
  const [savingProjects, setSavingProjects] = useState(false);
  const [projectsFilter, setProjectsFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newLoginId, setNewLoginId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  
  const [selectedCustomRole, setSelectedCustomRole] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const isAdmin = hasRole("admin");
  const { canEdit } = usePermissions();
  const canManageUsers = isAdmin || canEdit("user_management");

  useHighlightRow(users.map((u) => ({ id: u.user_id })));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, customRolesRes, userCustomRes, permsRes, projectsRes, userProjectsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("custom_roles").select("*").order("name"),
        supabase.from("user_custom_roles").select("*"),
        supabase.from("role_screen_permissions").select("*"),
        (supabase as any).rpc("list_assignable_projects"),
        (supabase.from as any)("user_projects").select("user_id, project_id"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (customRolesRes.error) throw customRolesRes.error;
      if (projectsRes.error) throw projectsRes.error;

      const userProjectsData: { user_id: string; project_id: string }[] = userProjectsRes?.data || [];

      const userList: UserWithRoles[] = (profilesRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        email: p.email,
        login_id: p.login_id ?? null,
        display_name: p.display_name,
        roles: (rolesRes.data || []).filter((r) => r.user_id === p.user_id).map((r) => r.role),
        custom_role_ids: (userCustomRes.data || []).filter((r) => r.user_id === p.user_id).map((r) => r.role_id),
        project_ids: userProjectsData.filter((up) => up.user_id === p.user_id).map((up) => up.project_id),
        created_at: p.created_at,
      }));

      setUsers(userList);
      setCustomRoles(customRolesRes.data || []);
      setRolePerms((permsRes.data || []) as RolePerm[]);
      setProjects((projectsRes.data || []) as ProjectLite[]);
    } catch (err: any) {
      toast.error("Failed to load: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageUsers) fetchAll();
  }, [canManageUsers, fetchAll]);

  const createUserFn = useServerFn(adminCreateUser);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = newLoginId.trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,40}$/.test(trimmedId)) {
      toast.error("User ID: 2-40 chars, letters, numbers, . _ - only");
      return;
    }
    setCreating(true);
    try {
      const result: any = await createUserFn({
        data: {
          loginId: trimmedId,
          password: newPassword,
          displayName: newDisplayName,
        },
      });
      console.log("[create user] server response:", result);

      if (!result || !result.userId) {
        throw new Error(
          result?.message || "Server did not confirm the new user. Please sign out and sign back in, then try again."
        );
      }

      toast.success(`User "${trimmedId}" created — they can log in immediately`);
      setNewLoginId(""); setNewPassword(""); setNewDisplayName("");
      setCreateOpen(false);
      await fetchAll();
    } catch (err: any) {
      console.error("[create user] failed:", err);
      const msg = err?.message || String(err) || "Failed to create user";
      if (/401|unauthor/i.test(msg)) {
        toast.error("Session expired. Please sign out and sign in again.");
      } else if (/403|forbidden|admin only/i.test(msg)) {
        toast.error("Only admins can create users.");
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  };


  const handleAssignCustomRole = async () => {
    if (!selectedUser || !selectedCustomRole) return;
    setSavingRole(true);
    try {
      // Replace any existing custom-role assignments so the user ends up with exactly one.
      const { error: delErr } = await supabase
        .from("user_custom_roles")
        .delete()
        .eq("user_id", selectedUser.user_id);
      if (delErr) throw delErr;

      const { error } = await supabase.from("user_custom_roles").insert({ user_id: selectedUser.user_id, role_id: selectedCustomRole });
      if (error) throw error;

      // Strip non-admin system roles so the custom role becomes the source of truth.
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.user_id)
        .neq("role", "admin" as any);

      toast.success("Custom role assigned");
      setCustomAssignOpen(false); setSelectedCustomRole("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign");
    } finally { setSavingRole(false); }
  };


  const handleRemoveCustomRole = async (userId: string, roleId: string) => {
    try {
      const { error } = await supabase.from("user_custom_roles").delete().eq("user_id", userId).eq("role_id", roleId);
      if (error) throw error;
      toast.success("Custom role removed");
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleDeleteCustomRole = async (id: string, name: string) => {
    if (!confirm(`Delete role "${name}"? This will unassign it from all users.`)) return;
    try {
      const { error } = await supabase.from("custom_roles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Role deleted");
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const openProjectsAssign = (u: UserWithRoles) => {
    setSelectedUser(u);
    setProjectsAssignSelection(new Set(u.project_ids));
    setProjectsFilter("");
    setProjectsAssignOpen(true);
  };

  const toggleProjectInSelection = (projectId: string) => {
    setProjectsAssignSelection((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const handleSaveProjectsAssign = async () => {
    if (!selectedUser) return;
    setSavingProjects(true);
    try {
      const current = new Set(selectedUser.project_ids);
      const next = projectsAssignSelection;
      const toAdd = [...next].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !next.has(id));

      if (toAdd.length === 0 && toRemove.length === 0) {
        toast.info("No changes to save");
        return;
      }

      if (toRemove.length > 0) {
        const { error } = await (supabase.from as any)("user_projects")
          .delete()
          .eq("user_id", selectedUser.user_id)
          .in("project_id", toRemove);
        if (error) {
          console.error("user_projects delete failed:", error);
          throw error;
        }
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((pid) => ({ user_id: selectedUser.user_id, project_id: pid }));
        const { error } = await (supabase.from as any)("user_projects").insert(rows);
        if (error) {
          console.error("user_projects insert failed:", error);
          throw error;
        }
      }

      // Verify what actually persisted
      const { data: verifyRows, error: verifyErr } = await (supabase.from as any)("user_projects")
        .select("project_id")
        .eq("user_id", selectedUser.user_id);
      if (verifyErr) {
        console.error("Verification read failed:", verifyErr);
        throw verifyErr;
      }
      const persisted = new Set((verifyRows || []).map((r: any) => r.project_id));
      const expected = next;
      const mismatch =
        persisted.size !== expected.size ||
        [...expected].some((id) => !persisted.has(id));

      if (mismatch) {
        toast.error(
          `Save did not persist (expected ${expected.size}, got ${persisted.size}). Check that you are signed in as an admin.`
        );
        return;
      }

      toast.success(`Project access updated (${persisted.size} project${persisted.size === 1 ? "" : "s"})`);
      setProjectsAssignOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to save project access");
    } finally {
      setSavingProjects(false);
    }
  };

  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage users, roles and screen permissions"
        actions={
          <Button onClick={() => setCreateOpen(!createOpen)}>
            {createOpen ? <><X className="h-4 w-4 mr-2" />Close</> : <><UserPlus className="h-4 w-4 mr-2" />Add User</>}
          </Button>
        }
      />

      {createOpen && (
        <Card>
          <CardHeader><CardTitle>Create New User</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input
                    required
                    value={newLoginId}
                    onChange={(e) => setNewLoginId(e.target.value)}
                    placeholder="e.g. kpc001 or john.doe"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">2-40 chars. Letters, numbers, . _ -</p>
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create User"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="custom-roles">Custom Roles</TabsTrigger>
        </TabsList>



        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Custom Roles</TableHead>
                      <TableHead>Projects</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const isUserAdmin = u.roles.includes("admin");
                      const noProjects = !isUserAdmin && u.project_ids.length === 0;
                      return (
                      <TableRow key={u.user_id} data-row-id={u.user_id}>
                        <TableCell className="font-medium">{u.login_id || u.email?.split("@")[0] || "—"}</TableCell>
                        <TableCell>{u.display_name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.custom_role_ids.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
                            {u.custom_role_ids.map((rid) => {
                              const r = customRoles.find((c) => c.id === rid);
                              if (!r) return null;
                              return (
                                <Badge key={rid} variant="outline" className="cursor-pointer group" onClick={() => handleRemoveCustomRole(u.user_id, rid)}>
                                  {r.name}<Trash2 className="h-3 w-3 ml-1 opacity-60 group-hover:opacity-100" />
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap max-w-[280px]">
                            {isUserAdmin ? (
                              <Badge variant="default" className="text-xs">All projects (admin)</Badge>
                            ) : noProjects ? (
                              <span className="text-amber-600 text-xs font-medium">⚠ No projects assigned</span>
                            ) : u.project_ids.length <= 3 ? (
                              u.project_ids.map((pid) => {
                                const p = projects.find((x) => x.id === pid);
                                if (!p) return null;
                                return <Badge key={pid} variant="secondary" className="text-xs">{p.code || p.name}</Badge>;
                              })
                            ) : (
                              <Badge variant="secondary" className="text-xs">{u.project_ids.length} projects</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="h-3 w-3 mr-1" />Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedUser(u); setCustomAssignOpen(true); }}>
                            <Key className="h-3 w-3 mr-1" />Custom
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openProjectsAssign(u)}>
                            <FolderKanban className="h-3 w-3 mr-1" />Projects
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={currentUser?.id === u.user_id}
                            title={currentUser?.id === u.user_id ? "You cannot delete your own account" : "Delete user"}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );})}
                    {users.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="custom-roles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Custom Roles</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Define custom roles with screen-level permissions</p>
              </div>
              <Button onClick={() => { setEditingRoleId(null); setRoleDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />New Role
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : customRoles.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No custom roles yet. Click "New Role" to create one.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Screen Access</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customRoles.map((r) => {
                      const perms = rolePerms.filter((p) => p.role_id === r.id && p.permission !== "none");
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.description || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {perms.length === 0 && <span className="text-muted-foreground text-sm">No access</span>}
                              {perms.map((p) => {
                                const screen = APP_SCREENS.find((s) => s.key === p.screen_key);
                                return (
                                  <Badge key={p.screen_key} variant={p.permission === "edit" ? "default" : "secondary"} className="text-xs">
                                    {screen?.label ?? p.screen_key} · {p.permission}
                                  </Badge>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right space-x-2 whitespace-nowrap">
                            <Button variant="outline" size="sm" onClick={() => { setEditingRoleId(r.id); setRoleDialogOpen(true); }}>
                              <Pencil className="h-3 w-3 mr-1" />Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteCustomRole(r.id, r.name)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Assign custom role dialog */}
      <Dialog open={customAssignOpen} onOpenChange={setCustomAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Custom Role to {selectedUser?.login_id || selectedUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedCustomRole} onValueChange={setSelectedCustomRole}>
              <SelectTrigger><SelectValue placeholder="Select a custom role" /></SelectTrigger>
              <SelectContent>
                {customRoles.filter((r) => !selectedUser?.custom_role_ids.includes(r.id)).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customRoles.length === 0 && <p className="text-sm text-muted-foreground">No custom roles exist yet. Create one in the Custom Roles tab.</p>}
            <Button onClick={handleAssignCustomRole} className="w-full" disabled={!selectedCustomRole || savingRole}>
              {savingRole ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Assign Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Projects assignment dialog */}
      <Dialog open={projectsAssignOpen} onOpenChange={setProjectsAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Projects to {selectedUser?.login_id || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedUser?.roles.includes("admin") && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                This user is an admin and already has access to all projects regardless of assignments below.
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search projects by name or code..."
                value={projectsFilter}
                onChange={(e) => setProjectsFilter(e.target.value)}
                className="h-9"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setProjectsAssignSelection(new Set(projects.map((p) => p.id)))}>Select all</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setProjectsAssignSelection(new Set())}>Clear</Button>
            </div>
            <p className="text-xs text-muted-foreground">{projectsAssignSelection.size} of {projects.length} selected</p>
            <div className="max-h-[400px] overflow-y-auto border rounded-md divide-y">
              {projects
                .filter((p) => {
                  if (!projectsFilter.trim()) return true;
                  const q = projectsFilter.trim().toLowerCase();
                  return (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q);
                })
                .map((p) => {
                  const checked = projectsAssignSelection.has(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggleProjectInSelection(p.id)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        {p.code && <div className="text-xs text-muted-foreground font-mono">{p.code}</div>}
                      </div>
                      {checked && <Check className="h-4 w-4 text-primary" />}
                    </label>
                  );
                })}
              {projects.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No projects found</div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setProjectsAssignOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveProjectsAssign} disabled={savingProjects}>
                {savingProjects ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RolePermissionsDialog
        open={roleDialogOpen}
        onOpenChange={(o) => { setRoleDialogOpen(o); if (!o) setEditingRoleId(null); }}
        roleId={editingRoleId}
        onSaved={fetchAll}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.login_id || deleteTarget?.email}</strong>
              {deleteTarget?.display_name ? ` (${deleteTarget.display_name})` : ""} along with their roles and project assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteUser(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o && !savingEdit) { setEditTarget(null); setEditPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user {editTarget?.login_id || editTarget?.email}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                value={editLoginId}
                onChange={(e) => setEditLoginId(e.target.value)}
                placeholder="e.g. kpc001 or john.doe"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">2-40 chars. Letters, numbers, . _ -</p>
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Passwords cannot be retrieved for security reasons. Leave blank to keep the current password, or enter a new one to reset it (min 6 characters).
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setEditTarget(null); setEditPassword(""); }} disabled={savingEdit}>Cancel</Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
