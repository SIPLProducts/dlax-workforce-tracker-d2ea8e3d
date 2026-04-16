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
import { UserPlus, Shield, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  created_at: string;
};

const ALL_ROLES = ["admin", "supervisor", "manager"] as const;

function UsersPage() {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);

  const isAdmin = hasRole("admin");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");
      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: allRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      if (rolesError) throw rolesError;

      const userList: UserWithRoles[] = (profiles || []).map((p) => ({
        user_id: p.user_id,
        email: p.email,
        display_name: p.display_name,
        roles: (allRoles || [])
          .filter((r) => r.user_id === p.user_id)
          .map((r) => r.role),
        created_at: p.created_at,
      }));

      setUsers(userList);
    } catch (err: any) {
      toast.error("Failed to load users: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      // Sign up the new user via client (will send verification email)
      const { error } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: { display_name: newDisplayName },
        },
      });
      if (error) throw error;

      toast.success("User invited! They'll receive a verification email.");
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setCreateOpen(false);
      // Refresh after a short delay for the trigger to create profile
      setTimeout(() => fetchUsers(), 1500);
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
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: selectedUser.user_id, role: selectedRole as any });
      if (error) throw error;
      toast.success(`Role "${selectedRole}" added to ${selectedUser.email}`);
      setRoleOpen(false);
      setSelectedRole("");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to add role");
    } finally {
      setSavingRole(false);
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);
      if (error) throw error;
      toast.success(`Role "${role}" removed`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove role");
    }
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
          <p className="text-sm text-muted-foreground">Manage users and their roles</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} />
              </div>
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
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.email || "—"}</TableCell>
                        <TableCell>{u.display_name || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {u.roles.length === 0 && <span className="text-muted-foreground text-sm">No role</span>}
                            {u.roles.map((r) => (
                              <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="capitalize">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No users found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Role Management</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Current Roles</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                                {r}
                                <Trash2 className="h-3 w-3 ml-1 opacity-60 group-hover:opacity-100" />
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog open={roleOpen && selectedUser?.user_id === u.user_id} onOpenChange={(open) => { setRoleOpen(open); if (open) setSelectedUser(u); }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Shield className="h-3 w-3 mr-1" />
                                Add Role
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add Role to {u.email}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_ROLES.filter((r) => !u.roles.includes(r)).map((r) => (
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
