import { ScreenGuard } from "@/components/ScreenGuard";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/approvals")({
  component: () => <ScreenGuard screen="approvals"><Page /></ScreenGuard>,
});

type Sheet = {
  id: string;
  sheet_code: string;
  project_id: string;
  entry_date: string;
  status: string;
  current_level: number;
  total_levels: number;
  submitted_by: string | null;
  submitted_at: string | null;
  rejection_remarks: string | null;
  total_headcount: number;
};

type Level = { project_id: string; level_no: number; approver_user_id: string; label: string | null };

const statusBadge = (s: string, current?: number, total?: number) => {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-900 border-amber-300",
    approved: "bg-emerald-100 text-emerald-900 border-emerald-300",
    rejected: "bg-red-100 text-red-900 border-red-300",
    draft: "bg-slate-100 text-slate-900 border-slate-300",
  };
  const label = s === "pending" ? `Pending — Level ${current}/${total}` : s.charAt(0).toUpperCase() + s.slice(1);
  return <Badge variant="outline" className={map[s] || ""}>{label}</Badge>;
};

function Page() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [rejectFor, setRejectFor] = useState<Sheet | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [actioning, setActioning] = useState(false);

  const isAdmin = hasRole("admin");

  const load = async () => {
    setLoading(true);
    const [sh, pr, lv] = await Promise.all([
      supabase.from("daily_manpower_sheets")
        .select("id, sheet_code, project_id, entry_date, status, current_level, total_levels, submitted_by, submitted_at, rejection_remarks")
        .order("entry_date", { ascending: false })
        .limit(500),
      supabase.from("projects").select("id,name,code"),
      supabase.from("project_approval_levels").select("project_id, level_no, approver_user_id, label"),
    ]);
    // Fetch totals
    const ids = (sh.data || []).map((s: any) => s.id);
    let totals: Record<string, number> = {};
    if (ids.length) {
      const { data: dm } = await supabase.from("daily_manpower").select("sheet_id, headcount").in("sheet_id", ids);
      (dm || []).forEach((r: any) => { totals[r.sheet_id] = (totals[r.sheet_id] || 0) + (r.headcount || 0); });
    }
    setSheets((sh.data || []).map((s: any) => ({ ...s, total_headcount: totals[s.id] || 0 })));
    setProjects((pr.data || []) as any);
    setLevels((lv.data || []) as Level[]);
    // Collect all user IDs referenced (submitters + approvers) and resolve via SECURITY DEFINER RPC
    const userIdSet = new Set<string>();
    (sh.data || []).forEach((s: any) => { if (s.submitted_by) userIdSet.add(s.submitted_by); });
    (lv.data || []).forEach((l: any) => { if (l.approver_user_id) userIdSet.add(l.approver_user_id); });
    const pMap: Record<string, string> = {};
    if (userIdSet.size) {
      const { data: pf } = await supabase.rpc("get_user_display_info", { _user_ids: Array.from(userIdSet) });
      (pf || []).forEach((p: any) => { pMap[p.user_id] = p.login_id || p.display_name || p.user_id.slice(0, 8); });
    }
    setProfiles(pMap);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isCurrentApprover = (s: Sheet) =>
    s.status === "pending" && levels.some((l) => l.project_id === s.project_id && l.level_no === s.current_level && l.approver_user_id === user?.id);

  const myPending = useMemo(() => sheets.filter(isCurrentApprover), [sheets, levels, user]);
  const mySubmissions = useMemo(() => sheets.filter((s) => s.submitted_by === user?.id), [sheets, user]);

  const projectName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.code ? p.code + " — " : ""}${p.name}` : id.slice(0, 8);
  };

  const approve = async (s: Sheet) => {
    setActioning(true);
    const { error } = await supabase.rpc("approve_sheet", { _sheet_id: s.id, _remarks: undefined });
    setActioning(false);
    if (error) return toast.error(error.message);
    toast.success("Approved");
    load();
  };
  const submitReject = async () => {
    if (!rejectFor) return;
    if (!rejectRemarks.trim()) return toast.error("Rejection remarks are required");
    setActioning(true);
    const { error } = await supabase.rpc("reject_sheet", { _sheet_id: rejectFor.id, _remarks: rejectRemarks.trim() });
    setActioning(false);
    if (error) return toast.error(error.message);
    toast.success("Rejected — sent back to submitter");
    setRejectFor(null); setRejectRemarks("");
    load();
  };

  const renderTable = (list: Sheet[], showActions: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sheet ID</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Project</TableHead>
          <TableHead className="text-right">Headcount</TableHead>
          <TableHead>Submitted By</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.length === 0 && (<TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No sheets</TableCell></TableRow>)}
        {list.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-mono">{s.sheet_code}</TableCell>
            <TableCell>{format(new Date(s.entry_date), "dd/MM/yyyy")}</TableCell>
            <TableCell className="font-medium">{projectName(s.project_id)}</TableCell>
            <TableCell className="text-right">{s.total_headcount}</TableCell>
            <TableCell>{s.submitted_by ? profiles[s.submitted_by] || "—" : "—"}</TableCell>
            <TableCell>{statusBadge(s.status, s.current_level, s.total_levels)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/daily-entry", search: { project: s.project_id, date: s.entry_date } })}><Eye className="w-4 h-4" /></Button>
                {showActions && s.status === "pending" && (isCurrentApprover(s) || isAdmin) && (
                  <>
                    <Button size="sm" variant="default" onClick={() => approve(s)} disabled={actioning}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectFor(s); setRejectRemarks(""); }} disabled={actioning}>
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
    <div className="space-y-4">
      <PageHeader
        title="Approvals"
        subtitle="Multi-level sequential approval — you only see sheets at your assigned level."
      />


      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">My Approvals ({myPending.length})</TabsTrigger>
          <TabsTrigger value="mine">My Submissions ({mySubmissions.length})</TabsTrigger>
          {isAdmin && <TabsTrigger value="all">All ({sheets.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="pending">
          <Card><CardContent className="p-0">{loading ? <div className="p-6 text-center"><Loader2 className="inline animate-spin" /></div> : renderTable(myPending, true)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="mine">
          <Card><CardContent className="p-0">{renderTable(mySubmissions, false)}</CardContent></Card>
        </TabsContent>
        {isAdmin && (
          <TabsContent value="all">
            <Card><CardContent className="p-0">{renderTable(sheets, true)}</CardContent></Card>
          </TabsContent>
        )}
      </Tabs>


      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Sheet</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rejection Remarks (required)</label>
            <Textarea value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} rows={4} />
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
