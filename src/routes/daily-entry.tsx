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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarIcon, Save, Eye, Pencil, Send, Plus } from "lucide-react";
import { format, parse as parseDate, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ScreenGuard } from "@/components/ScreenGuard";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/daily-entry")({
  component: () => <ScreenGuard screen="daily_entry"><DailyEntryPage /></ScreenGuard>,
});

type Cell = { key: string; deptId: string; catId: string; deptName: string; catName: string };
type GroupView = { deptId: string; deptName: string; headerClass: string; cellClass: string; cells: Cell[] };

const GROUP_PALETTE = [
  { headerClass: "bg-blue-100 text-blue-900", cellClass: "bg-blue-50/40" },
  { headerClass: "bg-emerald-100 text-emerald-900", cellClass: "bg-emerald-50/40" },
  { headerClass: "bg-orange-100 text-orange-900", cellClass: "bg-orange-50/40" },
  { headerClass: "bg-purple-100 text-purple-900", cellClass: "bg-purple-50/40" },
  { headerClass: "bg-pink-100 text-pink-900", cellClass: "bg-pink-50/40" },
  { headerClass: "bg-teal-100 text-teal-900", cellClass: "bg-teal-50/40" },
  { headerClass: "bg-amber-100 text-amber-900", cellClass: "bg-amber-50/40" },
  { headerClass: "bg-rose-100 text-rose-900", cellClass: "bg-rose-50/40" },
];
const OTHER_STYLE = { headerClass: "bg-slate-100 text-slate-900", cellClass: "bg-slate-50/40" };
const cellKey = (d: string, c: string) => `${d}__${c}`;

type RowData = { cells: Record<string, number>; remarks: string; weather: string };
const emptyRow = (): RowData => ({ cells: {}, remarks: "", weather: "" });

// Legacy JSON-blob keys → [department name, category name] for backward-compatible display
const LEGACY_KEY_MAP: Record<string, [string, string]> = {
  civil_rod_bending: ["CIVIL", "Rod Bending"],
  civil_shuttering: ["CIVIL", "Shuttering"],
  civil_mason: ["CIVIL", "Mason"],
  civil_scaffolders: ["CIVIL", "Scaffolders"],
  civil_painters: ["CIVIL", "Painters"],
  civil_helpers: ["CIVIL", "Helpers"],
  mep_plumbers: ["MEP", "Plumbers"],
  mep_carpenters: ["MEP", "Carpenters"],
  mep_fitters: ["MEP", "Fitters"],
  mep_welders: ["MEP", "Welders"],
  mep_electricians: ["MEP", "Electricians"],
  mep_helpers: ["MEP", "Helpers"],
  nmr_mason: ["NMR Man powers", "Mason"],
  nmr_mc: ["NMR Man powers", "M/C"],
  nmr_fc: ["NMR Man powers", "F /C"],
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
  const [assignedDepts, setAssignedDepts] = useState<{ id: string; name: string }[]>([]);
  const [assignedCats, setAssignedCats] = useState<{ id: string; name: string; display_order: number }[]>([]);
  const [deptCatLinks, setDeptCatLinks] = useState<{ department_id: string; category_id: string }[]>([]);
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
  const [activeTab, setActiveTab] = useState<"entry" | "saved">("entry");

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

  const { canEdit: canEditPerm } = usePermissions();
  const canEditScreen = canEditPerm("daily_entry");
  const requireEdit = () => {
    if (!canEditScreen) {
      toast.error("You are in View mode, not in Edit mode.");
      return false;
    }
    return true;
  };


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
      // Strict project scope: only show contractors assigned to this project via Masters → Project Assignments.
      if (!projectId) { setContractors([]); return; }
      const { data: joins } = await supabase
        .from("project_contractors")
        .select("contractor_id")
        .eq("project_id", projectId);
      const ids = (joins || []).map((j: any) => j.contractor_id);
      if (ids.length === 0) { setContractors([]); return; }
      const { data } = await supabase
        .from("contractors")
        .select("id,company_name,contact_number,work_place")
        .in("id", ids)
        .order("company_name");
      setContractors(data || []);
    };
    fetchContractors();
    const channel = supabase.channel("contractors-daily-entry")
      .on("postgres_changes", { event: "*", schema: "public", table: "contractors" }, () => fetchContractors())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_contractors" }, () => fetchContractors())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  // Strict project scope: load assigned departments / categories / links for this project.
  useEffect(() => {
    const fetchAssignments = async () => {
      if (!projectId) { setAssignedDepts([]); setAssignedCats([]); setDeptCatLinks([]); return; }
      const [{ data: pd }, { data: pc }, { data: dc }] = await Promise.all([
        supabase.from("project_departments").select("department_id").eq("project_id", projectId),
        supabase.from("project_categories").select("category_id").eq("project_id", projectId),
        supabase.from("department_categories").select("department_id, category_id"),
      ]);
      const deptIds = (pd || []).map((r: any) => r.department_id);
      const catIds = (pc || []).map((r: any) => r.category_id);
      const [{ data: depts }, { data: cats }] = await Promise.all([
        deptIds.length
          ? supabase.from("departments").select("id,name").in("id", deptIds).order("name")
          : Promise.resolve({ data: [] as any[] }),
        catIds.length
          ? supabase.from("worker_categories").select("id,name,display_order").in("id", catIds).order("display_order").order("name")
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setAssignedDepts(depts || []);
      setAssignedCats(cats || []);
      setDeptCatLinks(dc || []);
    };
    fetchAssignments();
    const channel = supabase.channel("assignments-daily-entry")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_departments" }, () => fetchAssignments())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_categories" }, () => fetchAssignments())
      .on("postgres_changes", { event: "*", schema: "public", table: "department_categories" }, () => fetchAssignments())
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, () => fetchAssignments())
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_categories" }, () => fetchAssignments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  // Build the dynamic column groups from assignments.
  const groups: GroupView[] = useMemo(() => {
    const linksByDept = new Map<string, Set<string>>();
    deptCatLinks.forEach((l) => {
      if (!linksByDept.has(l.department_id)) linksByDept.set(l.department_id, new Set());
      linksByDept.get(l.department_id)!.add(l.category_id);
    });
    const assignedCatIds = new Set(assignedCats.map((c) => c.id));
    const catById = new Map(assignedCats.map((c) => [c.id, c] as const));
    const placedCatIds = new Set<string>();
    const out: GroupView[] = assignedDepts.map((d, idx) => {
      const style = GROUP_PALETTE[idx % GROUP_PALETTE.length];
      const catIdsForDept = Array.from(linksByDept.get(d.id) || []).filter((cid) => assignedCatIds.has(cid));
      catIdsForDept.forEach((cid) => placedCatIds.add(cid));
      const cells: Cell[] = catIdsForDept
        .map((cid) => catById.get(cid)!)
        .filter(Boolean)
        .sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name))
        .map((c) => ({ key: cellKey(d.id, c.id), deptId: d.id, catId: c.id, deptName: d.name, catName: c.name }));
      return { deptId: d.id, deptName: d.name, headerClass: style.headerClass, cellClass: style.cellClass, cells };
    });
    const orphans = assignedCats.filter((c) => !placedCatIds.has(c.id));
    if (orphans.length > 0) {
      out.push({
        deptId: "__other__", deptName: "Other",
        headerClass: OTHER_STYLE.headerClass, cellClass: OTHER_STYLE.cellClass,
        cells: orphans.map((c) => ({ key: cellKey("__other__", c.id), deptId: "__other__", catId: c.id, deptName: "Other", catName: c.name })),
      });
    }
    return out.filter((g) => g.cells.length > 0);
  }, [assignedDepts, assignedCats, deptCatLinks]);

  const allCells: Cell[] = useMemo(() => groups.flatMap((g) => g.cells), [groups]);

  // Resolve legacy JSON-blob keys → (deptId, catId) using current assigned masters by name.
  const legacyKeyToCell = useMemo(() => {
    const deptByName = new Map(assignedDepts.map((d) => [d.name, d.id] as const));
    const catByName = new Map(assignedCats.map((c) => [c.name, c.id] as const));
    const map: Record<string, string> = {};
    Object.entries(LEGACY_KEY_MAP).forEach(([k, [dn, cn]]) => {
      const did = deptByName.get(dn); const cid = catByName.get(cn);
      if (did && cid) map[k] = cellKey(did, cid);
    });
    return map;
  }, [assignedDepts, assignedCats]);

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
        .select("contractor_id,department_id,category_id,headcount,security_count,deficiency_manpower,remarks,weather_condition,status")
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
    const touchedContractors = new Set<string>();
    (dm || []).forEach((rec: any) => {
      const r = next[rec.contractor_id] || emptyRow();
      // Header-level fields (kept on every row server-side; max wins on load)
      r.security = Math.max(r.security, rec.security_count || 0);
      r.deficiency = Math.max(r.deficiency, rec.deficiency_manpower || 0);
      r.weather = r.weather || rec.weather_condition || "";

      // Try legacy JSON-blob remarks first
      let isLegacyBlob = false;
      if (rec.remarks && typeof rec.remarks === "string" && rec.remarks.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(rec.remarks);
          if (parsed && typeof parsed === "object") {
            isLegacyBlob = true;
            r.remarks = r.remarks || parsed._remarks || "";
            Object.entries(parsed).forEach(([k, v]) => {
              if (k === "_remarks") return;
              const ck = legacyKeyToCell[k];
              if (ck && typeof v === "number") r.cells[ck] = (r.cells[ck] || 0) + v;
            });
          }
        } catch { /* fall through */ }
      }
      if (!isLegacyBlob) {
        if (rec.remarks && !r.remarks) r.remarks = rec.remarks;
        if (rec.department_id && rec.category_id) {
          const ck = cellKey(rec.department_id, rec.category_id);
          r.cells[ck] = (r.cells[ck] || 0) + (rec.headcount || 0);
        }
      }
      next[rec.contractor_id] = r;
      touchedContractors.add(rec.contractor_id);
    });
    const nRows = touchedContractors.size;
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

    // Determine final mode: explicit Edit click wins; otherwise default by date + editability.
    const sheetEditable = !sh || sh.status === "draft" || sh.status === "rejected";
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const selectedDateStr = format(date, "yyyy-MM-dd");
    const isPastDate = selectedDateStr < todayStr;
    if (pendingModeRef.current) {
      const requested = pendingModeRef.current;
      pendingModeRef.current = null;
      setMode(requested === "edit" && sheetEditable ? "edit" : "view");
    } else if (isPastDate) {
      setMode("view");
    } else if (nRows === 0) {
      setMode("edit");
    } else {
      setMode("view");
    }
  };

  useEffect(() => { loadEntries(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, date, contractors, assignedDepts, assignedCats]);

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
    setRows((prev) => {
      const curr = prev[cid] || emptyRow();
      return { ...prev, [cid]: { ...curr, cells: { ...curr.cells, [key]: val } } };
    });
  const updateField = (cid: string, key: "security" | "deficiency" | "remarks" | "weather", val: any) =>
    setRows((prev) => {
      const curr = prev[cid] || emptyRow();
      return { ...prev, [cid]: { ...curr, [key]: val } };
    });

  const rowTotal = (r: RowData) => allCells.reduce((s, c) => s + (Number(r.cells[c.key]) || 0), 0);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = { security: 0, deficiency: 0, total: 0 };
    allCells.forEach((c) => (t[c.key] = 0));
    contractors.forEach((c) => {
      const r = rows[c.id]; if (!r) return;
      allCells.forEach((col) => (t[col.key] += Number(r.cells[col.key]) || 0));
      t.security += Number(r.security) || 0;
      t.deficiency += Number(r.deficiency) || 0;
      t.total += rowTotal(r);
    });
    return t;
  }, [rows, contractors, allCells]);

  const handleSave = async () => {
    if (!requireEdit()) return;
    if (!projectId) return toast.error("Select a project");
    if (!user) return toast.error("Not signed in");
    if (!canEdit) return toast.error(editLockReason || "Cannot edit");
    if (allCells.length === 0) return toast.error("Assign Departments and Categories to this project in Masters → Project Assignments.");
    setSaving(true);
    const entry_date = format(date, "yyyy-MM-dd");

    // Resolve a real department for "Other" orphan cells via department_categories
    const orphanCatIds = allCells.filter((c) => c.deptId === "__other__").map((c) => c.catId);
    const orphanDeptByCat: Record<string, string> = {};
    if (orphanCatIds.length > 0) {
      const { data: dcRows } = await supabase
        .from("department_categories")
        .select("department_id, category_id")
        .in("category_id", orphanCatIds);
      (dcRows || []).forEach((r: any) => { if (!orphanDeptByCat[r.category_id]) orphanDeptByCat[r.category_id] = r.department_id; });
    }

    const inserts: any[] = [];
    contractors.forEach((c) => {
      const r = rows[c.id]; if (!r) return;
      const cellEntries = allCells
        .map((cell) => ({ cell, n: Number(r.cells[cell.key]) || 0 }))
        .filter((x) => x.n > 0);
      const hasHeader = (r.security > 0 || r.deficiency > 0 || (r.remarks && r.remarks.trim()) || (r.weather && r.weather.trim()));
      if (cellEntries.length === 0 && !hasHeader) return;

      // If only header-level data exists, anchor it to the first available cell (real dept, not "__other__")
      const anchor = allCells.find((cell) => cell.deptId !== "__other__") || allCells[0];
      const baseCells = cellEntries.length > 0 ? cellEntries : [{ cell: anchor, n: 0 }];

      baseCells.forEach((x, idx) => {
        const did = x.cell.deptId === "__other__"
          ? (orphanDeptByCat[x.cell.catId] || null)
          : x.cell.deptId;
        if (!did) return;
        inserts.push({
          project_id: projectId,
          entry_date,
          contractor_id: c.id,
          department_id: did,
          category_id: x.cell.catId,
          headcount: x.n,
          security_count: idx === 0 ? (Number(r.security) || 0) : 0,
          deficiency_manpower: idx === 0 ? (Number(r.deficiency) || 0) : 0,
          remarks: idx === 0 ? (r.remarks?.trim() ? r.remarks : null) : null,
          weather_condition: idx === 0 ? (r.weather || null) : null,
          created_by: user.id,
          submitted_by: user.id,
        });
      });
    });

    // Delete all editable rows for (project, date) then insert fresh. RLS allows delete only for draft/rejected.
    const { error: delErr } = await supabase
      .from("daily_manpower")
      .delete()
      .eq("project_id", projectId)
      .eq("entry_date", entry_date);
    if (delErr) {
      setSaving(false);
      return toast.error(delErr.message);
    }

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
    if (!requireEdit()) return;
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
    setMode("view");
    pendingModeRef.current = "view";
    await loadEntries(); await loadAllSheets();
  };

  const loadSheetIntoEditor = (s: SheetRow, asMode: "view" | "edit") => {
    pendingModeRef.current = asMode;
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
    <div className="space-y-4 max-w-[100vw]">
      <PageHeader
        title="Daily Manpower Entry"
        subtitle="Daily Labour Attendance Register"
        actions={
          <>
            {!isEmpty && (
              <Button variant="outline" onClick={() => setMode("view")} disabled={mode === "view"}>
                <Eye className="w-4 h-4 mr-2" /> View
              </Button>
            )}
            {canEdit ? (
              <Button variant="outline" onClick={() => { if (!requireEdit()) return; setMode("edit"); }} disabled={mode === "edit"}>
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
          </>
        }
      />

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
                    onSelect={(d) => { if (d) { setDate(d); setDateText(format(d, "dd/MM/yyyy")); setDateError(false); } }}
                    disabled={(d) => d > new Date(new Date().setHours(23, 59, 59, 999))}
                    initialFocus />
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
            <div className="text-sm w-full"><span className="text-muted-foreground">Submitted By:</span> <span className="font-medium">{submitterName || "—"}</span></div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "entry" | "saved")} className="space-y-4">
        <TabsList>
          <TabsTrigger value="entry">Entry Sheet</TabsTrigger>
          <TabsTrigger value="saved" className="gap-2">
            Saved Entries
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-semibold">{allSheets.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="mt-0">
      <Card>
        <CardContent className="p-0">
          <TableWithTopScroll>
            <table className="border-collapse text-xs w-full min-w-[1600px]">
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 160 }} />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-0 z-30 box-border">Sl.no</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-[48px] z-30 box-border text-left">Name of the Contractor</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-[268px] z-30 box-border">Contact No</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-[388px] z-30 box-border border-r-2 border-r-slate-300">Work Place</th>
                  {groups.map((g) => (
                    <th key={g.deptId} colSpan={g.cells.length} className={cn("border px-2 py-1 text-center font-semibold", g.headerClass)}>{g.deptName}</th>
                  ))}
                  <th rowSpan={2} className="border bg-green-100 text-green-900 px-2 py-2 min-w-[60px]">Total</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[70px]">Security</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[90px]">Deficieny<br/>Manpower</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[160px]">Remarks</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[130px]">Weather</th>
                </tr>
                <tr>
                  {groups.flatMap((g) => g.cells.map((c) => (
                    <th key={c.key} className={cn("border px-1 py-1 text-center font-medium min-w-[64px]", g.headerClass)}>{c.catName}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {loading && (<tr><td colSpan={4 + allCells.length + 5} className="text-center py-6 text-muted-foreground">Loading…</td></tr>)}
                {!loading && contractors.length === 0 && (<tr><td colSpan={4 + allCells.length + 5} className="text-center py-6 text-muted-foreground">No contractors assigned to this project. Assign some in Masters → Project Assignments.</td></tr>)}
                {!loading && contractors.length > 0 && allCells.length === 0 && (<tr><td colSpan={4 + 5} className="text-center py-6 text-muted-foreground">No departments or categories assigned to this project. Assign them in Masters → Project Assignments.</td></tr>)}
                {allCells.length > 0 && contractors.map((c, idx) => {
                  const r = rows[c.id] || emptyRow();
                  return (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="border text-center sticky left-0 bg-background z-20 box-border">{idx + 1}</td>
                      <td className="border px-2 sticky left-[48px] bg-background z-20 box-border font-medium truncate" title={c.company_name}>{c.company_name}</td>
                      <td className="border px-2 text-center sticky left-[268px] bg-background z-20 box-border truncate">{c.contact_number || ""}</td>
                      <td className="border px-2 sticky left-[388px] bg-background z-20 box-border border-r-2 border-r-slate-300 truncate" title={c.work_place || ""}>{c.work_place || ""}</td>
                      {groups.map((g) => g.cells.map((col) => (
                        <td key={col.key} className={cn("border", g.cellClass)}>
                          {numCell(r.cells[col.key] || 0, (n) => updateCell(c.id, col.key, n))}
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
              {contractors.length > 0 && allCells.length > 0 && (
                <tfoot>
                  <tr className="bg-yellow-100 font-bold">
                    <td className="border text-center sticky left-0 bg-yellow-100 z-20 box-border">TOTAL</td>
                    <td className="border sticky left-[48px] bg-yellow-100 z-20 box-border"></td>
                    <td className="border sticky left-[268px] bg-yellow-100 z-20 box-border"></td>
                    <td className="border sticky left-[388px] bg-yellow-100 z-20 box-border border-r-2 border-r-slate-300"></td>
                    {allCells.map((c) => (<td key={c.key} className="border text-center">{colTotals[c.key] || ""}</td>))}
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
        </TabsContent>

        <TabsContent value="saved" className="mt-0">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">Saved Entries</h2>
              <p className="text-xs text-muted-foreground">All saved daily sheets. Click View/Edit to load in the Entry Sheet tab.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { if (!requireEdit()) return; setMode("edit"); setDate(new Date()); setDateText(format(new Date(), "dd/MM/yyyy")); setActiveTab("entry"); }}>
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
                          <Button size="sm" variant="ghost" onClick={() => { loadSheetIntoEditor(s, "view"); setActiveTab("entry"); }}><Eye className="w-4 h-4" /></Button>
                          {editable ? (
                            <Button size="sm" variant="ghost" onClick={() => { if (!requireEdit()) return; loadSheetIntoEditor(s, "edit"); setActiveTab("entry"); }}><Pencil className="w-4 h-4" /></Button>
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
        </TabsContent>
      </Tabs>
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
