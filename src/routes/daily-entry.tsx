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
import { ProjectCombobox } from "@/components/ProjectCombobox";

export const Route = createFileRoute("/daily-entry")({
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search.project === "string" ? search.project : undefined,
    date: typeof search.date === "string" ? search.date : undefined,
  }),
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
  const [contractors, setContractors] = useState<{ id: string; company_name: string; contact_number: string | null; work_place: string | null; contractor_code: string | null }[]>([]);
  const [contractorsReady, setContractorsReady] = useState(false);
  const [assignedDepts, setAssignedDepts] = useState<{ id: string; name: string }[]>([]);
  const [assignedCats, setAssignedCats] = useState<{ id: string; name: string; display_order: number }[]>([]);
  const [deptCatLinks, setDeptCatLinks] = useState<{ department_id: string; category_id: string }[]>([]);
  const [assignmentsReady, setAssignmentsReady] = useState(false);
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
  // Cells from saved daily_manpower rows whose (dept, cat) is no longer in the
  // project's current assignments. Rendered read-only so totals reconcile and
  // historical data isn't silently dropped from the grid.
  const [orphanCells, setOrphanCells] = useState<Cell[]>([]);
  // IDs of saved daily_manpower rows that are orphan; Save preserves these.
  const orphanRowIdsRef = useRef<string[]>([]);
  const loadSeqRef = useRef(0);


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

  const search = Route.useSearch();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects").select("id,name,code").order("name");
      setProjects(data || []);
      if (data && data.length && !projectId) setProjectId(data[0].id);
    })();
  }, []);

  // Deep-link support: when arriving with ?project=&date=, preselect them and force View mode.
  useEffect(() => {
    if (search.project) setProjectId(search.project);
    if (search.date) {
      const d = parseDate(search.date, "yyyy-MM-dd", new Date());
      if (isValid(d)) { setDate(d); setDateText(format(d, "dd/MM/yyyy")); setDateError(false); }
    }
    if (search.project || search.date) {
      pendingModeRef.current = "view";
      setActiveTab("entry");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.project, search.date]);

  useEffect(() => {
    const fetchContractors = async () => {
      // Strict project scope: only show contractors assigned to this project via Masters → Project Assignments.
      if (!projectId) { setContractors([]); setContractorsReady(true); return; }
      setContractorsReady(false);
      const { data: joins } = await supabase
        .from("project_contractors")
        .select("contractor_id")
        .eq("project_id", projectId);
      const ids = (joins || []).map((j: any) => j.contractor_id);
      if (ids.length === 0) { setContractors([]); setContractorsReady(true); return; }
      const { data } = await supabase
        .from("contractors")
        .select("id,company_name,contact_number,work_place,contractor_code")
        .in("id", ids)
        .order("company_name");
      setContractors(data || []);
      setContractorsReady(true);
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
      if (!projectId) { setAssignedDepts([]); setAssignedCats([]); setDeptCatLinks([]); setAssignmentsReady(true); return; }
      setAssignmentsReady(false);
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
      setAssignmentsReady(true);
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
  const displayedCellSignature = useMemo(
    () => allCells.map((c) => `${c.key}:${c.deptName}:${c.catName}`).join("|"),
    [allCells]
  );

  // Display-only column set: assigned cells + orphan cells (saved earlier but
  // no longer assigned). Used for rendering and grand totals so the Entry
  // Sheet total matches Saved Entries. `allCells` stays unchanged for Save.
  const ORPHAN_STYLE = { headerClass: "bg-amber-100 text-amber-900", cellClass: "bg-amber-50/40" };
  const orphanGroup: GroupView | null = useMemo(() => {
    if (orphanCells.length === 0) return null;
    return {
      deptId: "__orphan__",
      deptName: "Unassigned (saved earlier)",
      headerClass: ORPHAN_STYLE.headerClass,
      cellClass: ORPHAN_STYLE.cellClass,
      cells: orphanCells,
    };
  }, [orphanCells]);
  const displayGroups: GroupView[] = useMemo(
    () => (orphanGroup ? [...groups, orphanGroup] : groups),
    [groups, orphanGroup]
  );
  const displayCells: Cell[] = useMemo(() => displayGroups.flatMap((g) => g.cells), [displayGroups]);
  const orphanKeySet = useMemo(() => new Set(orphanCells.map((c) => c.key)), [orphanCells]);


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
    const loadSeq = ++loadSeqRef.current;
    if (contractors.length > 0 && allCells.length === 0) {
      setRows(Object.fromEntries(contractors.map((c) => [c.id, emptyRow()])));
      setOrphanCells([]);
      orphanRowIdsRef.current = [];
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: dm }, { data: sh }, { data: cfg }, { data: lvs }] = await Promise.all([
      supabase.from("daily_manpower")
        .select("id,contractor_id,department_id,category_id,headcount,security_count,deficiency_manpower,remarks,weather_condition,status")
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
    if (loadSeq !== loadSeqRef.current) return;
    setLoading(false);

    const next: Record<string, RowData> = {};
    contractors.forEach((c) => (next[c.id] = emptyRow()));
    const touchedContractors = new Set<string>();
    (dm || []).forEach((rec: any) => {
      const r = next[rec.contractor_id] || emptyRow();
      // Header-level fields (kept on every row server-side; first non-empty wins)
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

    // Detect rows whose saved (dept, cat) is no longer one of the currently
    // displayed columns. Try to merge them by NAME into a visible column; only
    // rows that can't be name-matched become true orphans (kept read-only and
    // preserved on save). Merged rows are NOT preserved — Save's delete+insert
    // replaces them with the fresh merged value so they aren't double-counted.
    const displayedCellKeys = new Set<string>(allCells.map((c) => c.key));
    const nameToDisplayKey = new Map<string, string>();
    allCells.forEach((c) => {
      const nk = `${(c.deptName || "").trim().toLowerCase()}__${(c.catName || "").trim().toLowerCase()}`;
      if (!nameToDisplayKey.has(nk)) nameToDisplayKey.set(nk, c.key);
    });

    const unmatchedPairs = new Map<string, { deptId: string; catId: string }>();
    const unmatchedIds: string[] = [];
    // First pass: collect unique unknown (dept, cat) ids so we can resolve names
    const unknownDeptIds = new Set<string>();
    const unknownCatIds = new Set<string>();
    (dm || []).forEach((rec: any) => {
      if (!rec.department_id || !rec.category_id) return;
      const ck = cellKey(rec.department_id, rec.category_id);
      if (displayedCellKeys.has(ck)) return;
      unknownDeptIds.add(rec.department_id);
      unknownCatIds.add(rec.category_id);
    });
    const dnMap = new Map<string, string>();
    const cnMap = new Map<string, string>();
    if (unknownDeptIds.size > 0 || unknownCatIds.size > 0) {
      const [{ data: ds }, { data: cs }] = await Promise.all([
        unknownDeptIds.size
          ? supabase.from("departments").select("id, name").in("id", Array.from(unknownDeptIds))
          : Promise.resolve({ data: [] as any[] }),
        unknownCatIds.size
          ? supabase.from("worker_categories").select("id, name").in("id", Array.from(unknownCatIds))
          : Promise.resolve({ data: [] as any[] }),
      ]);
      (ds || []).forEach((d: any) => dnMap.set(d.id, d.name));
      (cs || []).forEach((c: any) => cnMap.set(c.id, c.name));
    }

    // Second pass: merge by name or mark as true orphan. Subtract any value
    // already added under the saved cellKey by the !isLegacyBlob branch so we
    // don't double-count when merging into a visible column.
    (dm || []).forEach((rec: any) => {
      if (!rec.department_id || !rec.category_id) return;
      const savedKey = cellKey(rec.department_id, rec.category_id);
      if (displayedCellKeys.has(savedKey)) return;
      const dName = dnMap.get(rec.department_id) || "";
      const cName = cnMap.get(rec.category_id) || "";
      const nk = `${dName.trim().toLowerCase()}__${cName.trim().toLowerCase()}`;
      const targetKey = nameToDisplayKey.get(nk);
      const r = next[rec.contractor_id] || emptyRow();
      if (targetKey) {
        // Remove the value added under the saved (orphan) key in the earlier
        // !isLegacyBlob branch, then add it to the visible column instead.
        if (r.cells[savedKey]) {
          r.cells[targetKey] = (r.cells[targetKey] || 0) + r.cells[savedKey];
          delete r.cells[savedKey];
        }
        // This row will be deleted by the normal delete+insert on Save.
      } else {
        unmatchedPairs.set(savedKey, { deptId: rec.department_id, catId: rec.category_id });
        unmatchedIds.push(rec.id);
        r.cells[savedKey] = r.cells[savedKey] || 0;
      }
      next[rec.contractor_id] = r;
    });
    orphanRowIdsRef.current = unmatchedIds;

    if (unmatchedPairs.size > 0) {
      const cells: Cell[] = Array.from(unmatchedPairs.entries()).map(([key, p]) => ({
        key,
        deptId: p.deptId,
        catId: p.catId,
        deptName: dnMap.get(p.deptId) || "Unassigned",
        catName: cnMap.get(p.catId) || "Unassigned",
      })).sort((a, b) => (a.deptName + a.catName).localeCompare(b.deptName + b.catName));
      setOrphanCells(cells);
    } else {
      setOrphanCells([]);
    }

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
      // Past dates always open read-only; user must click Edit to unlock.
      setMode("view");
    } else if (nRows === 0) {
      setMode("edit");
    } else {
      setMode("view");
    }
  };

  useEffect(() => { loadEntries(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId, date, contractors, displayedCellSignature]);

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
  const updateField = (cid: string, key: "remarks" | "weather", val: any) =>
    setRows((prev) => {
      const curr = prev[cid] || emptyRow();
      return { ...prev, [cid]: { ...curr, [key]: val } };
    });

  // Sum across every cell key present on a row (visible + orphan), so the
  // green Total column matches what Save will persist.
  const rowTotal = (r: RowData) => {
    let s = 0;
    displayCells.forEach((c) => { s += Number(r.cells[c.key]) || 0; });
    return s;
  };

  // Per-contractor totals memoized so React reliably re-renders the green
  // "Total" cell when any input changes.
  const rowTotals = useMemo(() => {
    const m: Record<string, number> = {};
    contractors.forEach((c) => {
      const r = rows[c.id]; if (!r) { m[c.id] = 0; return; }
      let s = 0;
      displayCells.forEach((col) => { s += Number(r.cells[col.key]) || 0; });
      m[c.id] = s;
    });
    return m;
  }, [rows, contractors, displayCells]);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = { total: 0 };
    displayCells.forEach((c) => (t[c.key] = 0));
    contractors.forEach((c) => {
      const r = rows[c.id]; if (!r) return;
      displayCells.forEach((col) => (t[col.key] += Number(r.cells[col.key]) || 0));
      t.total += rowTotals[c.id] || 0;
    });
    return t;
  }, [rows, contractors, displayCells, rowTotals]);


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
      const hasHeader = ((r.remarks && r.remarks.trim()) || (r.weather && r.weather.trim()));
      if (cellEntries.length === 0 && !hasHeader) return;

      // If only header-level data exists, anchor it to the first available cell (real dept, not "__other__")
      const anchor = allCells.find((cell) => cell.deptId !== "__other__") || allCells[0];
      const baseCells = cellEntries.length > 0 ? cellEntries : [{ cell: anchor, n: 0 }];

      // Dedupe by (department_id, category_id): "__other__" cells can resolve to a real
      // department that already has its own cell for the same category. Merge headcounts
      // and keep the first non-empty remarks/weather so we never violate the unique key.
      const merged = new Map<string, any>();
      baseCells.forEach((x, idx) => {
        const did = x.cell.deptId === "__other__"
          ? (orphanDeptByCat[x.cell.catId] || null)
          : x.cell.deptId;
        if (!did) return;
        const key = `${did}|${x.cell.catId}`;
        const remarks = idx === 0 ? (r.remarks?.trim() ? r.remarks : null) : null;
        const weather = idx === 0 ? (r.weather || null) : null;
        const existing = merged.get(key);
        if (existing) {
          existing.headcount += x.n;
          if (!existing.remarks && remarks) existing.remarks = remarks;
          if (!existing.weather_condition && weather) existing.weather_condition = weather;
          return;
        }
        merged.set(key, {
          project_id: projectId,
          entry_date,
          contractor_id: c.id,
          department_id: did,
          category_id: x.cell.catId,
          headcount: x.n,
          remarks,
          weather_condition: weather,
          status: 'draft',
          created_by: user.id,
          submitted_by: user.id,
        });
      });
      merged.forEach((row) => inserts.push(row));
    });

    console.debug("[daily-entry] save", {
      projectId,
      entry_date,
      canEdit,
      canEditScreen,
      allCellsCount: allCells.length,
      contractorsCount: contractors.length,
      orphanRowIds: orphanRowIdsRef.current.length,
      insertsCount: inserts.length,
    });

    // Delete editable rows for (project, date) then insert fresh. Preserve any
    // orphan rows (saved earlier with a dept/cat that is no longer assigned to
    // this project) so we don't silently destroy data the grid can't represent.
    // RLS allows delete only for draft/rejected.
    let delQ = supabase
      .from("daily_manpower")
      .delete()
      .eq("project_id", projectId)
      .eq("entry_date", entry_date);
    if (orphanRowIdsRef.current.length > 0) {
      // Postgres `not.in` requires a parenthesised list
      delQ = delQ.not("id", "in", `(${orphanRowIdsRef.current.join(",")})`);
    }
    const { error: delErr } = await delQ;
    if (delErr) {
      setSaving(false);
      console.error("[daily-entry] delete failed", delErr);
      return toast.error(delErr.message);
    }


    if (inserts.length === 0) {
      setSaving(false);
      if (orphanRowIdsRef.current.length > 0) {
        toast.success("Saved — only orphan rows preserved");
      } else {
        toast("Nothing to save — enter at least one headcount, remark, or weather");
      }
      await loadEntries(); await loadAllSheets();
      return;
    }



    const { error } = await supabase.from("daily_manpower").insert(inserts as any);

    setSaving(false);
    if (error) {
      console.error("[daily-entry] insert failed", error);
      return toast.error(error.message);
    }
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

      <Card className="sticky top-[112px] md:top-[120px] z-20 bg-background">
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
            <ProjectCombobox value={projectId} onChange={setProjectId} projects={projects} placeholder="Select project" />
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
        <div className="sticky top-[240px] md:top-[248px] z-10 bg-background py-2 -mt-2">
          <TabsList>
            <TabsTrigger value="entry">Entry Sheet</TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              Saved Entries
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-semibold">{allSheets.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="entry" className="mt-0">
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto rounded-md border" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            <table className="border-collapse text-xs w-full min-w-[1600px]">
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 160 }} />
              </colgroup>
              <thead className="bg-slate-100">
                <tr>
                  <th rowSpan={2} style={{ width: 48, minWidth: 48, maxWidth: 48 }} className="border bg-slate-100 bg-clip-padding px-2 py-2 sticky left-0 top-0 z-30 box-border">Sl.no</th>
                  <th rowSpan={2} style={{ width: 100, minWidth: 100, maxWidth: 100 }} className="border bg-slate-100 bg-clip-padding px-2 py-2 sticky left-[48px] top-0 z-30 box-border">SC Code</th>
                  <th rowSpan={2} style={{ width: 220, minWidth: 220, maxWidth: 220 }} className="border bg-slate-100 bg-clip-padding px-2 py-2 sticky left-[148px] top-0 z-30 box-border text-left">Name of the Contractor</th>
                  <th rowSpan={2} style={{ width: 120, minWidth: 120, maxWidth: 120 }} className="border bg-slate-100 bg-clip-padding px-2 py-2 sticky left-[368px] top-0 z-30 box-border">Contact No</th>
                  <th rowSpan={2} style={{ width: 160, minWidth: 160, maxWidth: 160 }} className="border bg-slate-100 bg-clip-padding px-2 py-2 sticky left-[488px] top-0 z-40 box-border border-r-2 border-r-slate-300">Work Place</th>
                  {displayGroups.map((g) => (
                    <th key={g.deptId} colSpan={g.cells.length} className={cn("border px-2 py-1 text-center font-semibold sticky top-0 z-20", g.headerClass)}>{g.deptName}</th>
                  ))}
                  <th rowSpan={2} className="border bg-green-100 text-green-900 px-2 py-2 min-w-[60px] sticky top-0 z-20">Total</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[160px] sticky top-0 z-20">Remarks</th>
                  <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[130px] sticky top-0 z-20">Weather</th>
                </tr>
                <tr>
                  {displayGroups.flatMap((g) => g.cells.map((c) => (
                    <th key={c.key} className={cn("border px-1 py-1 text-center font-medium min-w-[64px] sticky top-[36px] z-20", g.headerClass)}>{c.catName}</th>
                  )))}
                </tr>
              </thead>



              <tbody>
                {loading && (<tr><td colSpan={5 + displayCells.length + 3} className="text-center py-6 text-muted-foreground">Loading…</td></tr>)}
                {!loading && contractors.length === 0 && (<tr><td colSpan={5 + displayCells.length + 3} className="text-center py-6 text-muted-foreground">No contractors assigned to this project. Assign some in Masters → Project Assignments.</td></tr>)}
                {!loading && contractors.length > 0 && displayCells.length === 0 && (<tr><td colSpan={5 + 3} className="text-center py-6 text-muted-foreground">No departments or categories assigned to this project. Assign them in Masters → Project Assignments.</td></tr>)}
                {displayCells.length > 0 && contractors.map((c, idx) => {
                  const r = rows[c.id] || emptyRow();
                  return (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td style={{ width: 48, minWidth: 48, maxWidth: 48 }} className="border text-center sticky left-0 bg-background bg-clip-padding z-20 box-border">{idx + 1}</td>
                      <td style={{ width: 100, minWidth: 100, maxWidth: 100 }} className="border px-2 text-center sticky left-[48px] bg-background bg-clip-padding z-20 box-border truncate" title={c.contractor_code || ""}>{c.contractor_code || "—"}</td>
                      <td style={{ width: 220, minWidth: 220, maxWidth: 220 }} className="border px-2 sticky left-[148px] bg-background bg-clip-padding z-20 box-border font-medium truncate" title={c.company_name}>{c.company_name}</td>
                      <td style={{ width: 120, minWidth: 120, maxWidth: 120 }} className="border px-2 text-center sticky left-[368px] bg-background bg-clip-padding z-20 box-border truncate">{c.contact_number || ""}</td>
                      <td style={{ width: 160, minWidth: 160, maxWidth: 160 }} className="border px-2 sticky left-[488px] bg-background bg-clip-padding z-30 box-border border-r-2 border-r-slate-300 truncate" title={c.work_place || ""}>{c.work_place || ""}</td>
                      {displayGroups.map((g) => g.cells.map((col) => {
                        const isOrphan = orphanKeySet.has(col.key);
                        const val = r.cells[col.key] || 0;
                        if (isOrphan) {
                          return (
                            <td key={col.key} className={cn("border text-center text-amber-900", g.cellClass)}
                                title="Department/category no longer assigned to this project — re-assign in Masters → Project Assignments to edit.">
                              {val || ""}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className={cn("border", g.cellClass)}>
                            {numCell(val, (n) => updateCell(c.id, col.key, n))}
                          </td>
                        );
                      }))}
                      <td className="border bg-green-50 text-center font-semibold">{rowTotals[c.id] || ""}</td>
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
              {contractors.length > 0 && displayCells.length > 0 && (
                <tfoot>
                  <tr className="bg-yellow-100 font-bold">
                    <td style={{ width: 48, minWidth: 48, maxWidth: 48 }} className="border text-center sticky left-0 bg-yellow-100 bg-clip-padding z-20 box-border">TOTAL</td>
                    <td style={{ width: 100, minWidth: 100, maxWidth: 100 }} className="border sticky left-[48px] bg-yellow-100 bg-clip-padding z-20 box-border"></td>
                    <td style={{ width: 220, minWidth: 220, maxWidth: 220 }} className="border sticky left-[148px] bg-yellow-100 bg-clip-padding z-20 box-border"></td>
                    <td style={{ width: 120, minWidth: 120, maxWidth: 120 }} className="border sticky left-[368px] bg-yellow-100 bg-clip-padding z-20 box-border"></td>
                    <td style={{ width: 160, minWidth: 160, maxWidth: 160 }} className="border sticky left-[488px] bg-yellow-100 bg-clip-padding z-30 box-border border-r-2 border-r-slate-300"></td>
                    {displayCells.map((c) => (<td key={c.key} className="border text-center">{colTotals[c.key] || ""}</td>))}
                    <td className="border text-center bg-green-200">{colTotals.total || ""}</td>
                    <td className="border"></td>

                    <td className="border"></td>
                  </tr>
                </tfoot>

              )}
            </table>
          </div>

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
          <div className="overflow-auto rounded-md border" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-card [&_tr]:border-b">
                <tr className="border-b">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Sheet ID</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Date</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Project</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Total Headcount</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {allSheets.length === 0 && (
                  <tr className="border-b"><td colSpan={6} className="text-center text-muted-foreground py-6">No saved sheets yet</td></tr>
                )}
                {allSheets.map((s) => {
                  const m = statusMeta(s.status);
                  const editable = s.status === "draft" || s.status === "rejected" || s.status === "empty";
                  return (
                    <tr key={s.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-2 align-middle font-mono font-semibold">{s.sheet_code}</td>
                      <td className="p-2 align-middle">{format(parseDate(s.entry_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}</td>
                      <td className="p-2 align-middle">{projectName(s.project_id)}</td>
                      <td className="p-2 align-middle text-right">{s.total}</td>
                      <td className="p-2 align-middle"><Badge variant="outline" className={m.cls}>{m.label}</Badge></td>
                      <td className="p-2 align-middle text-right">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

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
      <div ref={topRef} onScroll={syncFromTop} className="overflow-x-auto overflow-y-hidden border-b bg-background">
        <div style={{ width, height: 1 }} />
      </div>
      <div ref={bottomRef} onScroll={syncFromBottom} className="overflow-x-auto">
        {children}
      </div>
    </>
  );
}
