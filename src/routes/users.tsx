import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
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
import { UserPlus, Shield, Trash2, Loader2, Plus, Pencil, Key } from "lucide-react";
import { toast } from "sonner";
import { RolePermissionsDialog } from "@/components/RolePermissionsDialog";
import { APP_SCREENS } from "@/lib/screens";

export const Route = createFileRoute("/users")({
  component: () => (
    <AuthGuard>
      <UsersPage />
    </AuthGuard>
  ),
});

type UserWithRoles = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  roles: string[];
  custom_role_ids: string[];
  created_at: string;
};

type CustomRole = {
  id: string;
  name: string;
  description: string | null;
};

type RolePerm = { role_id: string; screen_key: string; permission: string };

const ALL_ROLES = ["admin", "supervisor", "manager"] as const;

function UsersPage() {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [customAssignOpen, setCustomAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedCustomRole, setSelectedCustomRole] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const isAdmin = hasRole("admin");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, customRolesRes, userCustomRes, permsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("custom_roles").select("*").order("name"),
        supabase.from("user_custom_roles").select("*"),
        supabase.from("role_screen_permissions").select("*"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (customRolesRes.error) throw customRolesRes.error;

      const userList: UserWithRoles[] = (profilesRes.data || []).map((p) => ({
        user_id: p.user_id,
        email: p.email,
        display_name: p.display_name,
        roles: (rolesRes.data || []).filter((r) => r.user_id === p.user_id).map((r) => r.role),
        custom_role_ids: (userCustomRes.data || []).filter((r) => r.user_id === p.user_id).map((r) => r.role_id),
        created_at: p.created_at,
      }));

      setUsers(userList);
      setCustomRoles(customRolesRes.data || []);
      setRolePerms((permsRes.data || []) as RolePerm[]);
    } catch (err: any) {
      toast.error("Failed to load: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin, fetchAll]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { display_name: newDisplayName } },
      });
      if (error) throw error;
      toast.success("User invited! They'll receive a verification email.");
      setNewEmail(""); setNewPassword(""); setNewDisplayName("");
      setCreateOpen(false);
      setTimeout(() => fetchAll(), 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;
    setSavingRole(true);
    try {
      const { error } = await supabase.from("user_roles").insert({ user_id: selectedUser.user_id, role: selectedRole as any });
      if (error) throw error;
      toast.success(`Role "${selectedRole}" added`);
      setRoleOpen(false); setSelectedRole("");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to add role");
    } finally { setSavingRole(false); }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      if (error) throw error;
      toast.success(`Role "${role}" removed`);
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Failed"); }
  };

  const handleAssignCustomRole = async () => {
    if (!selectedUser || !selectedCustomRole) return;
    setSavingRole(true);
    try {
      const { error } = await supabase.from("user_custom_roles").insert({ user_id: selectedUser.user_id, role_id: selectedCustomRole });
      if (error) throw error;
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

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage users, roles and screen permissions</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2"><Label>Display Name</Label><Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="John Doe" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} /></div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">System Roles</TabsTrigger>
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
                      <TableHead>Email</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>System Roles</TableHead>
                      <TableHead>Custom Roles</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.email || "—"}</TableCell>
                        <TableCell>{u.display_name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
                            {u.roles.map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize">{r}</Badge>
                            ))}
                          </div>
                        </TableCell>
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
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedUser(u); setRoleOpen(true); }}>
                            <Shield className="h-3 w-3 mr-1" />System
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => { setSelectedUser(u); setCustomAssignOpen(true); }}>
                            <Key className="h-3 w-3 mr-1" />Custom
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader><CardTitle>System Role Management</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Current System Roles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.email || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {u.roles.length === 0 && <span className="text-muted-foreground text-sm">No role</span>}
                          {u.roles.map((r) => (
                            <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize group cursor-pointer" onClick={() => handleRemoveRole(u.user_id, r)}>
                              {r}<Trash2 className="h-3 w-3 ml-1 opacity-60 group-hover:opacity-100" />
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

      {/* Add system role dialog */}
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add System Role to {selectedUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {ALL_ROLES.filter((r) => !selectedUser?.roles.includes(r)).map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddRole} className="w-full" disabled={!selectedRole || savingRole}>
              {savingRole ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Add Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign custom role dialog */}
      <Dialog open={customAssignOpen} onOpenChange={setCustomAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Custom Role to {selectedUser?.email}</DialogTitle></DialogHeader>
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

      <RolePermissionsDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        roleId={editingRoleId}
        onSaved={fetchAll}
      />
    </div>
  );
}
