import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/approvals")({
  component: () => <AuthGuard><Page /></AuthGuard>,
});

type Entry = {
  id: string;
  entry_date: string;
  project_id: string;
  contractor_id: string;
  headcount: number;
  security_count: number;
  deficiency_manpower: number;
  remarks: string | null;
  status: string;
  submitted_by: string | null;
  submitted_at: string | null;
  l1_remarks: string | null;
  l2_remarks: string | null;
  rejection_remarks: string | null;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending_l1: "bg-amber-100 text-amber-900 border-amber-300",
    pending_l2: "bg-blue-100 text-blue-900 border-blue-300",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-300",
    rejected: "bg-red-100 text-red-900 border-red-300",
    draft: "bg-slate-100 text-slate-900 border-slate-300",
  };
  const label: Record<string, string> = {
    pending_l1: "Pending L1 (PC)",
    pending_l2: "Pending L2 (PM)",
    approved: "Approved",
    rejected: "Rejected",
    draft: "Draft",
  };
  return <Badge variant="outline" className={map[s] || ""}>{label[s] || s}</Badge>;
};

function Page() {
  const { user, hasRole } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [contractors, setContractors] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [configs, setConfigs] = useState<Record<string, { l1_user_id: string | null; l2_user_id: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [rejectFor, setRejectFor] = useState<Entry | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [actioning, setActioning] = useState(false);

  const isAdmin = hasRole("admin");
  const isPC = hasRole("project_coordinator");
  const isPM = hasRole("project_manager");

  const load = async () => {
    setLoading(true);
    const [mp, pr, ct, pf, cfg] = await Promise.all([
      supabase
        .from("daily_manpower")
        .select("id, entry_date, project_id, contractor_id, headcount, security_count, deficiency_manpower, remarks, status, submitted_by, submitted_at, l1_remarks, l2_remarks, rejection_remarks")
        .order("entry_date", { ascending: false })
        .limit(500),
      supabase.from("projects").select("id,name,code"),
      supabase.from("contractors").select("id, company_name"),
      supabase.from("profiles").select("user_id, display_name, login_id"),
      (supabase as any).from("project_approval_config").select("project_id, l1_user_id, l2_user_id, approval_enabled"),
    ]);
    setEntries((mp.data || []) as Entry[]);
    setProjects((pr.data || []) as any);
    const cMap: Record<string, string> = {};
    (ct.data || []).forEach((c: any) => { cMap[c.id] = c.company_name; });
    setContractors(cMap);
    const pMap: Record<string, string> = {};
    (pf.data || []).forEach((p: any) => { pMap[p.user_id] = p.display_name || p.login_id || p.user_id.slice(0, 8); });
    setProfiles(pMap);
    const cfgMap: Record<string, any> = {};
    (cfg.data || []).forEach((c: any) => { cfgMap[c.project_id] = c; });
    setConfigs(cfgMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const myPending = useMemo(() => entries.filter((e) => {
    if (e.status === "pending_l1") {
      return isAdmin || (isPC && configs[e.project_id]?.l1_user_id === user?.id);
    }
    if (e.status === "pending_l2") {
      return isAdmin || (isPM && configs[e.project_id]?.l2_user_id === user?.id);
    }
    return false;
  }), [entries, configs, user, isAdmin, isPC, isPM]);

  const mySubmissions = useMemo(() => entries.filter((e) => e.submitted_by === user?.id), [entries, user]);

  const applyFilters = (list: Entry[]) => list.filter((e) => {
    if (projectFilter !== "all" && e.project_id !== projectFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const projectName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.code ? p.code + " — " : ""}${p.name}` : id.slice(0, 8);
  };

  const approve = async (e: Entry) => {
    setActioning(true);
    const patch: any = {};
    if (e.status === "pending_l1") {
      patch.l1_approver_id = user?.id;
      patch.l1_action_at = new Date().toISOString();
      patch.status = "pending_l2";
      // If no L2 configured, advance directly to approved
      const cfg = configs[e.project_id];
      if (!cfg?.l2_user_id) patch.status = "approved";
    } else if (e.status === "pending_l2") {
      patch.l2_approver_id = user?.id;
      patch.l2_action_at = new Date().toISOString();
      patch.status = "approved";
    }
    const { error } = await supabase.from("daily_manpower").update(patch).eq("id", e.id);
    setActioning(false);
    if (error) return toast.error(error.message);
    toast.success("Approved");
    load();
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    if (!rejectRemarks.trim()) return toast.error("Rejection remarks are required");
    setActioning(true);
    const level = rejectFor.status === "pending_l1" ? 1 : 2;
    const patch: any = {
      status: "rejected",
      rejection_remarks: rejectRemarks.trim(),
      rejected_by_level: level,
    };
    if (level === 1) {
      patch.l1_approver_id = user?.id;
      patch.l1_action_at = new Date().toISOString();
      patch.l1_remarks = rejectRemarks.trim();
    } else {
      patch.l2_approver_id = user?.id;
      patch.l2_action_at = new Date().toISOString();
      patch.l2_remarks = rejectRemarks.trim();
    }
    const { error } = await supabase.from("daily_manpower").update(patch).eq("id", rejectFor.id);
    setActioning(false);
    if (error) return toast.error(error.message);
    toast.success("Rejected — sent back to supervisor");
    setRejectFor(null);
    setRejectRemarks("");
    load();
  };

  const renderTable = (list: Entry[], showActions: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Contractor</TableHead>
          <TableHead className="text-right">Headcount</TableHead>
          <TableHead>Submitted By</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.length === 0 && (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No entries</TableCell></TableRow>
        )}
        {list.map((e) => (
          <TableRow key={e.id}>
            <TableCell>{format(new Date(e.entry_date), "dd/MM/yyyy")}</TableCell>
            <TableCell className="font-medium">{projectName(e.project_id)}</TableCell>
            <TableCell>{contractors[e.contractor_id] || "—"}</TableCell>
            <TableCell className="text-right">{e.headcount}</TableCell>
            <TableCell>{e.submitted_by ? profiles[e.submitted_by] || "—" : "—"}</TableCell>
            <TableCell>{statusBadge(e.status)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setViewing(e)}><Eye className="w-4 h-4" /></Button>
                {showActions && (e.status === "pending_l1" || e.status === "pending_l2") && (
                  <>
                    <Button size="sm" variant="default" onClick={() => approve(e)} disabled={actioning}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectFor(e); setRejectRemarks(""); }} disabled={actioning}>
                      <XCircle className="w-4 h-4 mr-1" />Reject
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-muted-foreground">Two-level approval workflow for daily manpower entries</p>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-3 items-end">
          <div className="space-y-1 min-w-[200px]">
            <label className="text-xs font-medium">Project</label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[180px]">
            <label className="text-xs font-medium">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending_l1">Pending L1</SelectItem>
                <SelectItem value="pending_l2">Pending L2</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Refresh
          </Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending My Approval ({myPending.length})</TabsTrigger>
          <TabsTrigger value="mine">My Submissions ({mySubmissions.length})</TabsTrigger>
          <TabsTrigger value="all">All History ({entries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card><CardContent className="p-0">{renderTable(applyFilters(myPending), true)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="mine">
          <Card><CardContent className="p-0">{renderTable(applyFilters(mySubmissions), false)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="all">
          <Card><CardContent className="p-0">{renderTable(applyFilters(entries), isAdmin)}</CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Entry Details</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Date:</span> {format(new Date(viewing.entry_date), "dd/MM/yyyy")}</div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(viewing.status)}</div>
                <div><span className="text-muted-foreground">Project:</span> {projectName(viewing.project_id)}</div>
                <div><span className="text-muted-foreground">Contractor:</span> {contractors[viewing.contractor_id]}</div>
                <div><span className="text-muted-foreground">Headcount:</span> {viewing.headcount}</div>
                <div><span className="text-muted-foreground">Security:</span> {viewing.security_count}</div>
                <div><span className="text-muted-foreground">Deficiency:</span> {viewing.deficiency_manpower}</div>
                <div><span className="text-muted-foreground">Submitted by:</span> {viewing.submitted_by ? profiles[viewing.submitted_by] : "—"}</div>
              </div>
              {viewing.remarks && (() => {
                try {
                  const j = JSON.parse(viewing.remarks);
                  return (
                    <div>
                      <div className="font-medium mb-1">Breakdown</div>
                      <div className="grid grid-cols-3 gap-1 text-xs bg-muted/30 p-2 rounded">
                        {Object.entries(j).filter(([k]) => k !== "_remarks").map(([k, v]) => (
                          <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</div>
                        ))}
                      </div>
                      {j._remarks && <div className="mt-2"><span className="text-muted-foreground">Remarks:</span> {j._remarks}</div>}
                    </div>
                  );
                } catch { return <div className="text-xs">{viewing.remarks}</div>; }
              })()}
              {viewing.l1_remarks && <div className="text-xs"><b>L1 remarks:</b> {viewing.l1_remarks}</div>}
              {viewing.l2_remarks && <div className="text-xs"><b>L2 remarks:</b> {viewing.l2_remarks}</div>}
              {viewing.rejection_remarks && <div className="text-xs text-red-700"><b>Rejection:</b> {viewing.rejection_remarks}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Entry</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rejection Remarks (required)</label>
            <Textarea value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} rows={4} placeholder="Explain why this entry is being rejected..." />
            <p className="text-xs text-muted-foreground">The supervisor will see these remarks and can edit & resubmit the entry.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject} disabled={actioning}>
              {actioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
