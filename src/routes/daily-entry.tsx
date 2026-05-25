import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, Save, Eye, Pencil, Send, Plus } from "lucide-react";
import { format, parse as parseDate, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScreenGuard } from "@/components/ScreenGuard";

export const Route = createFileRoute("/daily-entry")({
  component: () => <ScreenGuard screen="daily_entry"><DailyEntryPage /></ScreenGuard>,
});

type ColDef = { key: string; label: string };
type GroupDef = { key: "CIVIL" | "MEP" | "NMR"; label: string; cols: ColDef[]; headerClass: string; cellClass: string };

const GROUPS: GroupDef[] = [
  { key: "CIVIL", label: "CIVIL - Item rate / Subcontract", headerClass: "bg-blue-100 text-blue-900", cellClass: "bg-blue-50/40",
    cols: [
      { key: "civil_rod_bending", label: "Rod Bending" },
      { key: "civil_shuttering", label: "Shuttering" },
      { key: "civil_mason", label: "Mason" },
      { key: "civil_scaffolders", label: "Scaffolders" },
      { key: "civil_painters", label: "Painters" },
      { key: "civil_helpers", label: "Helpers" },
    ] },
  { key: "MEP", label: "MEP - Item rate / Subcontract", headerClass: "bg-emerald-100 text-emerald-900", cellClass: "bg-emerald-50/40",
    cols: [
      { key: "mep_plumbers", label: "Plumbers" },
      { key: "mep_carpenters", label: "Carpenters" },
      { key: "mep_fitters", label: "Fitters" },
      { key: "mep_welders", label: "Welders" },
      { key: "mep_electricians", label: "Electricians" },
      { key: "mep_helpers", label: "Helpers" },
    ] },
  { key: "NMR", label: "NMR Man powers", headerClass: "bg-orange-100 text-orange-900", cellClass: "bg-orange-50/40",
    cols: [
      { key: "nmr_mason", label: "Mason" },
      { key: "nmr_mc", label: "M/C" },
      { key: "nmr_fc", label: "F/C" },
    ] },
];

const ALL_COLS: ColDef[] = GROUPS.flatMap((g) => g.cols);

type RowData = Record<string, number> & { security: number; deficiency: number; remarks: string; weather: string };
const emptyRow = (): RowData => {
  const r: any = { security: 0, deficiency: 0, remarks: "", weather: "" };
  ALL_COLS.forEach((c) => (r[c.key] = 0));
  return r as RowData;
};

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Rainy", "Heavy Rain", "Stormy", "Foggy", "Hot", "Windy"];

type SheetRow = {
  id: string;
  sheet_code: string;
  project_id: string;
  entry_date: string;
  status: string;
  current_level: number;
  total_levels: number;
  total: number;
};

function statusMeta(s: string) {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: "bg-slate-100 text-slate-900 border-slate-300", label: "Draft" },
    pending: { cls: "bg-amber-100 text-amber-900 border-amber-300", label: "Pending Approval" },
    approved: { cls: "bg-emerald-100 text-emerald-900 border-emerald-300", label: "Approved" },
    rejected: { cls: "bg-red-100 text-red-900 border-red-300", label: "Rejected" },
    empty: { cls: "bg-slate-50 text-slate-600 border-slate-200", label: "No entries yet" },
  };
  return map[s] || { cls: "", label: s };
}

function DailyEntryPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [dateText, setDateText] = useState(format(new Date(), "dd/MM/yyyy"));
  const [dateError, setDateError] = useState(false);

  const [projects, setProjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [contractors, setContractors] = useState<{ id: string; company_name: string; contact_number: string | null; work_place: string | null }[]>([]);
  const [rows, setRows] = useState<Record<string, RowData>>({});
  const [sheet, setSheet] = useState<{ id: string; sheet_code: string; status: string; current_level: number; total_levels: number; submitted_by: string | null } | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [approvalEnabled, setApprovalEnabled] = useState(false);
  const [levels, setLevels] = useState<{ level_no: number; approver_user_id: string; label: string | null }[]>([]);
  const [approverNames, setApproverNames] = useState<Record<string, string>>({});
  const [submitterName, setSubmitterName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const pendingModeRef = useRef<"view" | "edit" | null>(null);
  const [allSheets, setAllSheets] = useState<SheetRow[]>([]);

  const sheetStatus = sheet ? sheet.status : (rowCount === 0 ? "empty" : "draft");
  const isEmpty = sheetStatus === "empty";
  const canEdit = isEmpty || sheetStatus === "draft" || sheetStatus === "rejected";
  const currentApproverName = sheet && sheet.status === "pending"
    ? approverNames[levels.find((l) => l.level_no === sheet.current_level)?.approver_user_id || ""] || `Level ${sheet.current_level}`
    : "";
  const editLockReason =
    sheetStatus === "approved" ? "Approved — cannot modify" :
    sheetStatus === "pending" ? `Awaiting approval at Level ${sheet?.current_level} (${currentApproverName})` :
    "";
  const readOnly = mode === "view" || !canEdit;


  const tryParseDate = (s: string): Date | null => {
    for (const f of ["dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "d/M/yyyy", "d-M-yyyy"]) {
      const d = parseDate(s, f, new Date());
      if (isValid(d)) return d;
    }
    return null;
  };

  const handleDateTextChange = (raw: string) => {
    setDateText(raw);
    const parsed = tryParseDate(raw);
    if (parsed) { setDate(parsed); setDateError(false); } else { setDateError(raw.length > 0); }
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects").select("id,name,code").order("name");
      setProjects(data || []);
      if (data && data.length && !projectId) setProjectId(data[0].id);
    })();
  }, []);

  useEffect(() => {
    const fetchContractors = async () => {
      const { data } = await supabase.from("contractors").select("id,company_name,contact_number,work_place").order("company_name");
      setContractors(data || []);
    };
    fetchContractors();
    const channel = supabase.channel("contractors-daily-entry")
      .on("postgres_changes", { event: "*", schema: "public", table: "contractors" }, () => fetchContractors())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, RowData> = {};
      contractors.forEach((c) => (next[c.id] = prev[c.id] || emptyRow()));
      return next;
    });
  }, [contractors]);

  // Load existing sheet for project+date
  const loadEntries = async () => {
    if (!projectId) return;
    setLoading(true);
    const [{ data: dm }, { data: sh }, { data: cfg }, { data: lvs }] = await Promise.all([
      supabase.from("daily_manpower")
        .select("contractor_id,headcount,security_count,deficiency_manpower,remarks,weather_condition,status")
        .eq("project_id", projectId)
        .eq("entry_date", format(date, "yyyy-MM-dd")),
      supabase.from("daily_manpower_sheets")
        .select("id, sheet_code, status, current_level, total_levels, submitted_by")
        .eq("project_id", projectId)
        .eq("entry_date", format(date, "yyyy-MM-dd"))
        .maybeSingle(),
      supabase.from("project_approval_config").select("approval_enabled").eq("project_id", projectId).maybeSingle(),
      supabase.from("project_approval_levels").select("level_no, approver_user_id, label").eq("project_id", projectId).order("level_no"),
    ]);
    setLoading(false);

    const next: Record<string, RowData> = {};
    contractors.forEach((c) => (next[c.id] = emptyRow()));
    let nRows = 0;
    (dm || []).forEach((rec: any) => {
      const r = next[rec.contractor_id] || emptyRow();
      r.security = rec.security_count || 0;
      r.deficiency = rec.deficiency_manpower || 0;
      try {
        const parsed = rec.remarks ? JSON.parse(rec.remarks) : null;
        if (parsed && typeof parsed === "object") {
          r.remarks = parsed._remarks || "";
          ALL_COLS.forEach((c) => { if (typeof parsed[c.key] === "number") (r as any)[c.key] = parsed[c.key]; });
        } else if (typeof rec.remarks === "string") {
          r.remarks = rec.remarks;
        }
      } catch { r.remarks = rec.remarks || ""; }
      r.weather = rec.weather_condition || "";
      next[rec.contractor_id] = r;
      nRows += 1;
    });
    setRows(next);
    setRowCount(nRows);
    setSheet(sh ? { id: sh.id, sheet_code: sh.sheet_code, status: sh.status, current_level: sh.current_level, total_levels: sh.total_levels, submitted_by: sh.submitted_by ?? null } : null);
    setApprovalEnabled(!!(cfg as any)?.approval_enabled);
    const levelList = (lvs || []) as any[];
    setLevels(levelList);

    // Fetch approver + submitter display names
    const ids = Array.from(new Set([
      ...levelList.map((l) => l.approver_user_id),
      ...(sh?.submitted_by ? [sh.submitted_by] : []),
    ]));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, login_id").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.display_name || p.login_id || p.user_id.slice(0, 8); });
      setApproverNames(map);
      setSubmitterName(sh?.submitted_by ? (map[sh.submitted_by] || "") : "");
    } else {
      setApproverNames({});
      setSubmitterName("");
    }

    // Determine final mode: explicit Edit click wins; otherwise default by editability.
    const sheetEditable = !sh || sh.status === "draft" || sh.status === "rejected";
    if (pendingModeRef.current) {
      const requested = pendingModeRef.current;
      pendingModeRef.current = null;
      setMode(requested === "edit" && sheetEditable ? "edit" : "view");
    } else if (nRows === 0) {
      setMode("edit");
    } else {
      setMode("view");
    }
  };

  useEffect(() => { loadEntries(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, date, contractors]);

  // Load all sheets for the saved-entries table below
  const loadAllSheets = async () => {
    const { data: sheets } = await supabase
      .from("daily_manpower_sheets")
      .select("id, sheet_code, project_id, entry_date, status, current_level, total_levels")
      .order("entry_date", { ascending: false })
      .limit(500);
    const sheetIds = (sheets || []).map((s: any) => s.id);
    let totals: Record<string, number> = {};
    if (sheetIds.length > 0) {
      const { data: dm } = await supabase
        .from("daily_manpower")
        .select("sheet_id, headcount")
        .in("sheet_id", sheetIds);
      (dm || []).forEach((r: any) => { totals[r.sheet_id] = (totals[r.sheet_id] || 0) + (r.headcount || 0); });
    }
    setAllSheets((sheets || []).map((s: any) => ({
      id: s.id,
      sheet_code: s.sheet_code,
      project_id: s.project_id,
      entry_date: s.entry_date,
      status: s.status,
      current_level: s.current_level,
      total_levels: s.total_levels,
      total: totals[s.id] || 0,
    })));
  };
  useEffect(() => { loadAllSheets(); }, []);


  const updateCell = (cid: string, key: string, val: number) =>
    setRows((prev) => ({ ...prev, [cid]: { ...prev[cid], [key]: val } as RowData }));
  const updateField = (cid: string, key: "security" | "deficiency" | "remarks" | "weather", val: any) =>
    setRows((prev) => ({ ...prev, [cid]: { ...prev[cid], [key]: val } as RowData }));

  const rowTotal = (r: RowData) => ALL_COLS.reduce((s, c) => s + (Number((r as any)[c.key]) || 0), 0);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = { security: 0, deficiency: 0, total: 0 };
    ALL_COLS.forEach((c) => (t[c.key] = 0));
    contractors.forEach((c) => {
      const r = rows[c.id]; if (!r) return;
      ALL_COLS.forEach((col) => (t[col.key] += Number((r as any)[col.key]) || 0));
      t.security += Number(r.security) || 0;
      t.deficiency += Number(r.deficiency) || 0;
      t.total += rowTotal(r);
    });
    return t;
  }, [rows, contractors]);

  const handleSave = async () => {
    if (!projectId) return toast.error("Select a project");
    if (!user) return toast.error("Not signed in");
    if (!canEdit) return toast.error(editLockReason || "Cannot edit");
    setSaving(true);
    const entry_date = format(date, "yyyy-MM-dd");

    const { data: cats } = await supabase.from("worker_categories").select("id").limit(1);
    const { data: deps } = await supabase.from("departments").select("id").limit(1);
    const fallbackCat = cats?.[0]?.id;
    const fallbackDep = deps?.[0]?.id;
    if (!fallbackCat || !fallbackDep) {
      setSaving(false);
      return toast.error("Add at least one Department and Category in Masters first");
    }

    await supabase.from("daily_manpower").delete().eq("project_id", projectId).eq("entry_date", entry_date);

    const inserts = contractors.map((c) => {
      const r = rows[c.id]; if (!r) return null;
      const total = rowTotal(r);
      const hasAny = total > 0 || r.security > 0 || r.deficiency > 0 || (r.remarks && r.remarks.trim());
      if (!hasAny) return null;
      const payload: any = { _remarks: r.remarks || "" };
      ALL_COLS.forEach((col) => (payload[col.key] = Number((r as any)[col.key]) || 0));
      return {
        project_id: projectId,
        entry_date,
        contractor_id: c.id,
        department_id: fallbackDep,
        category_id: fallbackCat,
        headcount: total,
        security_count: Number(r.security) || 0,
        deficiency_manpower: Number(r.deficiency) || 0,
        remarks: JSON.stringify(payload),
        created_by: user.id,
        submitted_by: user.id,
      };
    }).filter(Boolean);

    if (inserts.length === 0) {
      setSaving(false);
      toast.success("Saved (no entries)");
      await loadEntries(); await loadAllSheets();
      return;
    }

    const { error } = await supabase.from("daily_manpower").insert(inserts as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    await loadEntries(); await loadAllSheets();
    toast.success(`Saved as Draft`);
    setMode("view");
  };

  const handleSendToApproval = async () => {
    if (!sheet) return toast.error("Save the sheet first");
    if (sheet.status !== "draft" && sheet.status !== "rejected") return toast.error("Sheet is already submitted");
    setSending(true);
    const { data, error } = await supabase.rpc("submit_sheet", { _sheet_id: sheet.id });
    setSending(false);
    if (error) return toast.error(error.message);
    const updated: any = data;
    if (updated?.status === "approved") {
      toast.success("Approval not configured — sheet auto-approved");
    } else {
      const firstApprover = approverNames[levels.find((l) => l.level_no === 1)?.approver_user_id || ""] || "Level 1 approver";
      toast.success(`Sent for approval to ${firstApprover}`);
    }
    await loadEntries(); await loadAllSheets();
  };

  const loadSheetIntoEditor = (s: SheetRow, asMode: "view" | "edit") => {
    setProjectId(s.project_id);
    const d = parseDate(s.entry_date, "yyyy-MM-dd", new Date());
    if (isValid(d)) { setDate(d); setDateText(format(d, "dd/MM/yyyy")); setDateError(false); }
    setMode(asMode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sendFromList = async (s: SheetRow) => {
    if (s.status !== "draft" && s.status !== "rejected") return toast.error("Sheet already submitted");
    const { error } = await supabase.rpc("submit_sheet", { _sheet_id: s.id });
    if (error) return toast.error(error.message);
    toast.success(`${s.sheet_code} sent for approval`);
    await loadAllSheets();
    if (s.project_id === projectId && s.entry_date === format(date, "yyyy-MM-dd")) await loadEntries();
  };


  const projectName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.code ? p.code + " — " : ""}${p.name}` : id.slice(0, 8);
  };

  const numCell = (val: number, onChange: (n: number) => void, extraClass = "") => (
    <input
      type="number" min={0} value={val || ""} disabled={readOnly}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={cn(
        "w-full h-9 px-1 text-center text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70 disabled:cursor-not-allowed",
        extraClass
      )}
    />
  );

  const sMeta = statusMeta(sheetStatus);

  return (
    <TooltipProvider>
    <div className="p-4 space-y-4 max-w-[100vw]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Daily Manpower Entry</h1>
          <p className="text-sm text-muted-foreground">Daily Labour Attendance Register</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isEmpty && (
            <Button variant="outline" onClick={() => setMode("view")} disabled={mode === "view"}>
              <Eye className="w-4 h-4 mr-2" /> View
            </Button>
          )}
          {canEdit ? (
            <Button variant="outline" onClick={() => setMode("edit")} disabled={mode === "edit"}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Button variant="outline" disabled><Pencil className="w-4 h-4 mr-2" /> Edit</Button></span>
              </TooltipTrigger>
              <TooltipContent>{editLockReason}</TooltipContent>
            </Tooltip>
          )}
          {mode === "edit" && (
            <Button onClick={handleSave} disabled={saving || !canEdit}>
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save"}
            </Button>
          )}
          {(() => {
            const canSend = !isEmpty && approvalEnabled && levels.length > 0 && (sheetStatus === "draft" || sheetStatus === "rejected");
            const reason = isEmpty ? "Save the sheet first"
              : !approvalEnabled ? "Approval not enabled for this project"
              : levels.length === 0 ? "No approval levels configured for this project"
              : sheetStatus === "pending" ? "Already pending approval"
              : sheetStatus === "approved" ? "Already approved"
              : "";
            const btn = (
              <Button variant="default" onClick={handleSendToApproval} disabled={!canSend || sending}>
                <Send className="w-4 h-4 mr-2" /> {sending ? "Sending..." : "Send to Approval"}
              </Button>
            );
            return canSend ? btn : (
              <Tooltip>
                <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
                <TooltipContent>{reason}</TooltipContent>
              </Tooltip>
            );
          })()}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Date</label>
            <div className="flex gap-1">
              <Input value={dateText} onChange={(e) => handleDateTextChange(e.target.value)} placeholder="dd/MM/yyyy"
                className={cn("w-36", dateError && "border-destructive")} />
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" size="icon"><CalendarIcon className="w-4 h-4" /></Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date}
                    onSelect={(d) => { if (d) { setDate(d); setDateText(format(d, "dd/MM/yyyy")); setDateError(false); } }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-1 min-w-[240px]">
            <label className="text-xs font-medium">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {sheet?.sheet_code && <div className="text-sm"><span className="text-muted-foreground">Sheet ID:</span> <span className="font-mono font-semibold">{sheet.sheet_code}</span></div>}
            <Badge variant="outline" className={sMeta.cls}>
              {sMeta.label}
              {sheet?.status === "pending" && ` — Level ${sheet.current_level}/${sheet.total_levels}${currentApproverName ? ` (${currentApproverName})` : ""}`}
            </Badge>
            {mode === "edit" && <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300">Editing</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TableWithTopScroll>
            <table className="border-collapse text-xs w-full min-w-[1600px]">
              <thead>
                <tr>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-0 z-20 w-12">Sl.no</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-12 z-20 min-w-[200px] text-left">Name of the Contractor</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[110px]">Contact No</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[140px]">Work Place</th>
                  {GROUPS.map((g) => (
                    <th key={g.key} colSpan={g.cols.length} className={cn("border px-2 py-1 text-center font-semibold", g.headerClass)}>{g.label}</th>
                  ))}
                  <th rowSpan={2} className="border bg-green-100 text-green-900 px-2 py-2 min-w-[60px]">Total</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[70px]">Security</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[90px]">Deficieny<br/>Manpower</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[160px]">Remarks</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[130px]">Weather</th>
                </tr>
                <tr>
                  {GROUPS.flatMap((g) => g.cols.map((c) => (
                    <th key={c.key} className={cn("border px-1 py-1 text-center font-medium min-w-[64px]", g.headerClass)}>{c.label}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {loading && (<tr><td colSpan={4 + ALL_COLS.length + 5} className="text-center py-6 text-muted-foreground">Loading…</td></tr>)}
                {!loading && contractors.length === 0 && (<tr><td colSpan={4 + ALL_COLS.length + 5} className="text-center py-6 text-muted-foreground">No contractors. Add some in Masters → Contractors.</td></tr>)}
                {contractors.map((c, idx) => {
                  const r = rows[c.id] || emptyRow();
                  return (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="border text-center sticky left-0 bg-background z-10">{idx + 1}</td>
                      <td className="border px-2 sticky left-12 bg-background z-10 font-medium">{c.company_name}</td>
                      <td className="border px-2 text-center">{c.contact_number || ""}</td>
                      <td className="border px-2">{c.work_place || ""}</td>
                      {GROUPS.map((g) => g.cols.map((col) => (
                        <td key={col.key} className={cn("border", g.cellClass)}>
                          {numCell((r as any)[col.key] || 0, (n) => updateCell(c.id, col.key, n))}
                        </td>
                      )))}
                      <td className="border bg-green-50 text-center font-semibold">{rowTotal(r) || ""}</td>
                      <td className="border">{numCell(r.security, (n) => updateField(c.id, "security", n))}</td>
                      <td className="border">{numCell(r.deficiency, (n) => updateField(c.id, "deficiency", n))}</td>
                      <td className="border">
                        <input value={r.remarks} disabled={readOnly}
                          onChange={(e) => updateField(c.id, "remarks", e.target.value)}
                          className="w-full h-9 px-2 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70" />
                      </td>
                      <td className="border">
                        <Select value={r.weather || undefined} disabled={readOnly} onValueChange={(v) => updateField(c.id, "weather", v)}>
                          <SelectTrigger className="h-9 border-0 bg-transparent rounded-none focus:ring-2 focus:ring-primary/40 min-w-[120px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {WEATHER_OPTIONS.map((w) => (<SelectItem key={w} value={w}>{w}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {contractors.length > 0 && (
                <tfoot>
                  <tr className="bg-yellow-100 font-bold">
                    <td className="border text-center sticky left-0 bg-yellow-100 z-10" colSpan={2}>TOTAL</td>
                    <td className="border" colSpan={2}></td>
                    {ALL_COLS.map((c) => (<td key={c.key} className="border text-center">{colTotals[c.key] || ""}</td>))}
                    <td className="border text-center bg-green-200">{colTotals.total || ""}</td>
                    <td className="border text-center">{colTotals.security || ""}</td>
                    <td className="border text-center">{colTotals.deficiency || ""}</td>
                    <td className="border"></td>
                    <td className="border"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </TableWithTopScroll>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Saved Entries</h2>
              <p className="text-xs text-muted-foreground">All saved daily sheets. Click View/Edit to load above.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setMode("edit"); setDate(new Date()); setDateText(format(new Date(), "dd/MM/yyyy")); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <Plus className="w-4 h-4 mr-2" /> New Entry
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sheet ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Total Headcount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSheets.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No saved sheets yet</TableCell></TableRow>
                )}
                {allSheets.map((s) => {
                  const m = statusMeta(s.status);
                  const editable = s.status === "draft" || s.status === "rejected" || s.status === "empty";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-semibold">{s.sheet_code}</TableCell>
                      <TableCell>{format(parseDate(s.entry_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{projectName(s.project_id)}</TableCell>
                      <TableCell className="text-right">{s.total}</TableCell>
                      <TableCell><Badge variant="outline" className={m.cls}>{m.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => loadSheetIntoEditor(s, "view")}><Eye className="w-4 h-4" /></Button>
                          {editable ? (
                            <Button size="sm" variant="ghost" onClick={() => loadSheetIntoEditor(s, "edit")}><Pencil className="w-4 h-4" /></Button>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild><span><Button size="sm" variant="ghost" disabled><Pencil className="w-4 h-4" /></Button></span></TooltipTrigger>
                              <TooltipContent>{s.status === "approved" ? "Approved — cannot modify" : "Awaiting approval"}</TooltipContent>
                            </Tooltip>
                          )}
                          {(s.status === "draft" || s.status === "rejected") && (
                            <Button size="sm" variant="default" onClick={() => sendFromList(s)}>
                              <Send className="w-4 h-4 mr-1" /> Send to Approval
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}

function TableWithTopScroll({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const inner = bottomRef.current?.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const update = () => setWidth(inner.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [children]);

  const syncFromTop = () => { if (topRef.current && bottomRef.current) bottomRef.current.scrollLeft = topRef.current.scrollLeft; };
  const syncFromBottom = () => { if (topRef.current && bottomRef.current) topRef.current.scrollLeft = bottomRef.current.scrollLeft; };

  return (
    <>
      <div ref={topRef} onScroll={syncFromTop} className="overflow-x-auto overflow-y-hidden border-b sticky top-0 z-30 bg-background">
        <div style={{ width, height: 1 }} />
      </div>
      <div ref={bottomRef} onScroll={syncFromBottom} className="overflow-auto">
        {children}
      </div>
    </>
  );
}
