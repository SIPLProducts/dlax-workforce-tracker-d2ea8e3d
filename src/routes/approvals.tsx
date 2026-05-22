import { ScreenGuard } from "@/components/ScreenGuard";
import { createFileRoute } from "@tanstack/react-router";
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
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [viewing, setViewing] = useState<Sheet | null>(null);
  const [rejectFor, setRejectFor] = useState<Sheet | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [actioning, setActioning] = useState(false);

  const isAdmin = hasRole("admin");

  const load = async () => {
    setLoading(true);
    const [sh, pr, pf, lv] = await Promise.all([
      supabase.from("daily_manpower_sheets")
        .select("id, sheet_code, project_id, entry_date, status, current_level, total_levels, submitted_by, submitted_at, rejection_remarks")
        .order("entry_date", { ascending: false })
        .limit(500),
      supabase.from("projects").select("id,name,code"),
      supabase.from("profiles").select("user_id, display_name, login_id"),
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
    const pMap: Record<string, string> = {};
    (pf.data || []).forEach((p: any) => { pMap[p.user_id] = p.display_name || p.login_id || p.user_id.slice(0, 8); });
    setProfiles(pMap);
    setLevels((lv.data || []) as Level[]);
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
    const { error } = await supabase.rpc("approve_sheet", { _sheet_id: s.id, _remarks: null });
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
                <Button size="sm" variant="ghost" onClick={() => setViewing(s)}><Eye className="w-4 h-4" /></Button>
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
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-muted-foreground">Multi-level sequential approval — you only see sheets at your assigned level.</p>
      </div>

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

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Sheet {viewing?.sheet_code}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Date:</span> {format(new Date(viewing.entry_date), "dd/MM/yyyy")}</div>
              <div><span className="text-muted-foreground">Project:</span> {projectName(viewing.project_id)}</div>
              <div><span className="text-muted-foreground">Status:</span> {statusBadge(viewing.status, viewing.current_level, viewing.total_levels)}</div>
              <div><span className="text-muted-foreground">Total Headcount:</span> {viewing.total_headcount}</div>
              <div><span className="text-muted-foreground">Submitted by:</span> {viewing.submitted_by ? profiles[viewing.submitted_by] : "—"}</div>
              {viewing.rejection_remarks && <div className="text-red-700"><b>Rejection remarks:</b> {viewing.rejection_remarks}</div>}
              <div className="pt-2 border-t">
                <div className="text-xs font-medium mb-1">Approval levels</div>
                {levels.filter((l) => l.project_id === viewing.project_id).sort((a,b)=>a.level_no-b.level_no).map((l) => (
                  <div key={l.level_no} className="text-xs flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">L{l.level_no}</Badge>
                    {l.label && <span className="text-muted-foreground">{l.label}:</span>}
                    <span>{profiles[l.approver_user_id] || l.approver_user_id.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
