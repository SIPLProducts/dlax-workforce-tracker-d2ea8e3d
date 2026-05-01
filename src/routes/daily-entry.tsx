import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Copy, Save, FileDown, Upload, ClipboardList, Inbox } from "lucide-react";
import { format, subDays, parse as parseDate, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/daily-entry")({
  component: () => <AuthGuard><DailyEntryPage /></AuthGuard>,
});

type CellMap = Record<string, number>; // key: `${contractor_id}:${category_id}` -> headcount
type ExtraMap = Record<string, { security: number; deficiency: number; remarks: string }>; // key: contractor_id

const GROUP_ORDER = ["CIVIL", "MEP", "NMR"] as const;
const GROUP_LABELS: Record<string, string> = {
  CIVIL: "CIVIL — Item rate / Subcontract",
  MEP: "MEP — Item rate / Subcontract",
  NMR: "NMR Man powers",
  OTHER: "Other",
};

function DailyEntryPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [dateText, setDateText] = useState<string>(format(new Date(), "dd/MM/yyyy"));
  const [dateError, setDateError] = useState(false);

  const tryParseDate = (s: string): Date | null => {
    const formats = ["dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "d/M/yyyy", "d-M-yyyy"];
    for (const f of formats) {
      const d = parseDate(s, f, new Date());
      if (isValid(d)) return d;
    }
    return null;
  };

  const handleDateTextChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = raw;
    if (raw === digits && digits.length > 0) {
      if (digits.length <= 2) formatted = digits;
      else if (digits.length <= 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      else formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    setDateText(formatted);
    const parsed = tryParseDate(formatted);
    if (parsed) { setDate(parsed); setDateError(false); }
  };

  const handleDateBlur = () => {
    const parsed = tryParseDate(dateText);
    if (parsed) {
      setDate(parsed);
      setDateText(format(parsed, "dd/MM/yyyy"));
      setDateError(false);
    } else {
      setDateError(true);
      setDateText(format(date, "dd/MM/yyyy"));
      setTimeout(() => setDateError(false), 1500);
    }
  };

  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cells, setCells] = useState<CellMap>({});
  const [extras, setExtras] = useState<ExtraMap>({});
  const [saving, setSaving] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [mastersLoaded, setMastersLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMasters(); }, []);
  useEffect(() => { if (projectId && date) loadEntries(); }, [projectId, date]);

  const loadMasters = async () => {
    const [p, c, cat] = await Promise.all([
      supabase.from("projects").select("*").eq("status", "Active").order("name"),
      supabase.from("contractors").select("*").order("nature_of_work").order("company_name"),
      supabase.from("worker_categories").select("*").order("display_order").order("name"),
    ]);
    const projectList = p.data || [];
    setProjects(projectList);
    if (projectList.length === 1 && !projectId) setProjectId(projectList[0].id);
    setContractors(c.data || []);
    setCategories(cat.data || []);
    setMastersLoaded(true);
  };

  const loadEntries = async () => {
    const { data } = await supabase
      .from("daily_manpower")
      .select("*")
      .eq("entry_date", format(date, "yyyy-MM-dd"))
      .eq("project_id", projectId);
    const cellMap: CellMap = {};
    const extraMap: ExtraMap = {};
    (data || []).forEach((r: any) => {
      cellMap[`${r.contractor_id}:${r.category_id}`] = r.headcount || 0;
      // For each contractor, aggregate the security / deficiency / remarks (we store them on every row, so any row works)
      if (!extraMap[r.contractor_id]) {
        extraMap[r.contractor_id] = {
          security: r.security_count || 0,
          deficiency: r.deficiency_manpower || 0,
          remarks: r.remarks || "",
        };
      }
    });
    setCells(cellMap);
    setExtras(extraMap);
  };

  // Group categories by category_group, preserving display_order
  const groupedCategories = useMemo(() => {
    const groups: Record<string, any[]> = { CIVIL: [], MEP: [], NMR: [], OTHER: [] };
    categories.forEach((c) => {
      const g = (c.category_group || "OTHER").toUpperCase();
      if (groups[g]) groups[g].push(c);
      else groups.OTHER.push(c);
    });
    const ordered: { group: string; cats: any[] }[] = [];
    GROUP_ORDER.forEach((g) => { if (groups[g].length) ordered.push({ group: g, cats: groups[g] }); });
    if (groups.OTHER.length) ordered.push({ group: "OTHER", cats: groups.OTHER });
    return ordered;
  }, [categories]);

  const flatCategories = useMemo(() => groupedCategories.flatMap((g) => g.cats), [groupedCategories]);

  // Group contractors by nature_of_work
  const groupedContractors = useMemo(() => {
    const groups = new Map<string, any[]>();
    contractors.forEach((c) => {
      const key = (c.nature_of_work || "").trim() || "Uncategorised";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });
    return Array.from(groups.entries()).map(([name, list]) => ({ name, list }));
  }, [contractors]);

  const setCell = (contractorId: string, categoryId: string, value: number) => {
    setCells((prev) => ({ ...prev, [`${contractorId}:${categoryId}`]: value }));
  };
  const setExtra = (contractorId: string, field: "security" | "deficiency" | "remarks", value: any) => {
    setExtras((prev) => ({
      ...prev,
      [contractorId]: { security: 0, deficiency: 0, remarks: "", ...prev[contractorId], [field]: value },
    }));
  };

  const rowTotal = (contractorId: string) =>
    flatCategories.reduce((s, cat) => s + (cells[`${contractorId}:${cat.id}`] || 0), 0);

  const colTotal = (categoryId: string) =>
    contractors.reduce((s, c) => s + (cells[`${c.id}:${categoryId}`] || 0), 0);

  const grandTotal = useMemo(() =>
    Object.values(cells).reduce((s, v) => s + (v || 0), 0)
  , [cells]);

  const securityTotal = useMemo(() =>
    Object.values(extras).reduce((s, e) => s + (e.security || 0), 0)
  , [extras]);

  const copyPreviousDay = async () => {
    if (!projectId) { toast.error("Select a project"); return; }
    const prevDate = format(subDays(date, 1), "yyyy-MM-dd");
    const { data } = await supabase
      .from("daily_manpower")
      .select("*")
      .eq("entry_date", prevDate)
      .eq("project_id", projectId);
    if (data && data.length > 0) {
      const cellMap: CellMap = {};
      const extraMap: ExtraMap = {};
      data.forEach((r: any) => {
        cellMap[`${r.contractor_id}:${r.category_id}`] = r.headcount || 0;
        if (!extraMap[r.contractor_id]) {
          extraMap[r.contractor_id] = {
            security: r.security_count || 0,
            deficiency: r.deficiency_manpower || 0,
            remarks: r.remarks || "",
          };
        }
      });
      setCells(cellMap);
      setExtras(extraMap);
      toast.success("Copied from previous day");
    } else {
      toast.info("No entries found for previous day");
    }
  };

  const save = async () => {
    if (!projectId) { toast.error("Select a project"); return; }
    setSaving(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      // Delete all existing for this date+project
      await supabase.from("daily_manpower").delete().eq("entry_date", dateStr).eq("project_id", projectId);

      const inserts: any[] = [];
      contractors.forEach((c) => {
        const ex = extras[c.id] || { security: 0, deficiency: 0, remarks: "" };
        const contractorCells = flatCategories
          .map((cat) => ({ cat, hc: cells[`${c.id}:${cat.id}`] || 0 }))
          .filter((x) => x.hc > 0);

        if (contractorCells.length === 0 && ex.security === 0 && ex.deficiency === 0 && !ex.remarks) {
          return; // nothing to save for this contractor
        }

        // Need a category for any contractor with extras-only data; pick first available category
        const rows = contractorCells.length > 0
          ? contractorCells
          : (flatCategories[0] ? [{ cat: flatCategories[0], hc: 0 }] : []);

        rows.forEach((row) => {
          inserts.push({
            entry_date: dateStr,
            project_id: projectId,
            contractor_id: c.id,
            // department_id is required NOT NULL — use the first department available
            department_id: defaultDepartmentId,
            category_id: row.cat.id,
            headcount: row.hc,
            security_count: ex.security || 0,
            deficiency_manpower: ex.deficiency || 0,
            remarks: ex.remarks || null,
            created_by: user?.id,
          });
        });
      });

      if (inserts.length === 0) {
        toast.info("Nothing to save");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("daily_manpower").insert(inserts);
      if (error) throw error;
      toast.success(`Saved ${inserts.length} entries`);
      loadEntries();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // department_id is still NOT NULL on daily_manpower; load a default department
  const [defaultDepartmentId, setDefaultDepartmentId] = useState<string>("");
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("departments").select("id").order("name").limit(1).maybeSingle();
      if (data?.id) setDefaultDepartmentId(data.id);
    })();
  }, []);

  const downloadTemplate = () => {
    const headerRow1: any[] = ["Sl.no", "Name of the Contractor", "Contact No", "Work Place"];
    const headerRow2: any[] = ["", "", "", ""];
    groupedCategories.forEach((g) => {
      g.cats.forEach((c, idx) => {
        headerRow1.push(idx === 0 ? GROUP_LABELS[g.group] : "");
        headerRow2.push(c.name);
      });
    });
    headerRow1.push("Total", "Security", "Deficiency Manpower", "Remarks");
    headerRow2.push("", "", "", "");

    const data: any[][] = [headerRow1, headerRow2];
    let sl = 1;
    groupedContractors.forEach((g) => {
      data.push([g.name]);
      g.list.forEach((c) => {
        const row: any[] = [sl++, c.company_name, c.contact_number || "", c.work_place || ""];
        flatCategories.forEach((cat) => row.push(cells[`${c.id}:${cat.id}`] || ""));
        row.push(rowTotal(c.id) || "", extras[c.id]?.security || "", extras[c.id]?.deficiency || "", extras[c.id]?.remarks || "");
        data.push(row);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manpower");
    XLSX.writeFile(wb, `manpower_${format(date, "yyyy-MM-dd")}.xlsx`);
    toast.success("Sheet downloaded");
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
      if (rows.length < 3) { toast.error("Sheet appears empty"); return; }
      const subHeader = rows[1].map((v) => String(v).toLowerCase().trim());
      const contractorMap = new Map(contractors.map((c) => [String(c.company_name).toLowerCase().trim(), c]));
      const catMap = new Map(flatCategories.map((c) => [String(c.name).toLowerCase().trim(), c]));

      const newCells: CellMap = { ...cells };
      const newExtras: ExtraMap = { ...extras };
      let updated = 0;
      for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r[1] || "").toLowerCase().trim();
        if (!name) continue;
        const cont = contractorMap.get(name);
        if (!cont) continue;
        for (let col = 4; col < subHeader.length - 4; col++) {
          const cat = catMap.get(subHeader[col]);
          if (!cat) continue;
          const val = parseInt(String(r[col] || 0)) || 0;
          newCells[`${cont.id}:${cat.id}`] = val;
        }
        const lastIdx = subHeader.length;
        const sec = parseInt(String(r[lastIdx - 3] || 0)) || 0;
        const def = parseInt(String(r[lastIdx - 2] || 0)) || 0;
        const rem = String(r[lastIdx - 1] || "");
        newExtras[cont.id] = { security: sec, deficiency: def, remarks: rem };
        updated++;
      }
      setCells(newCells);
      setExtras(newExtras);
      toast.success(`Loaded ${updated} contractor rows. Click Save to persist.`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selProj = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-5 pb-28 md:pb-24">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">Daily Operations</p>
            <h1 className="text-[24px] font-semibold text-foreground tracking-tight leading-tight mt-1">
              GENMNGR — Manpower Details {selProj && <span className="text-muted-foreground font-normal text-base">· {selProj.name}</span>}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">As on {format(date, "dd.MM.yyyy")} · One row per contractor, headcounts grouped by trade.</p>
          </div>
          <div className="inline-flex items-center -space-x-px rounded-md shadow-sm">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} className="hidden" />
            <Button variant="outline" size="sm" className="h-9 rounded-r-none focus:z-10" onClick={downloadTemplate}>
              <FileDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />Export
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-l-none focus:z-10" onClick={() => fileInputRef.current?.click()} disabled={bulkUploading}>
              <Upload className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />{bulkUploading ? "Uploading..." : "Import"}
            </Button>
          </div>
        </div>
        <div className="hairline-x h-px w-full" />
      </div>

      {mastersLoaded && projects.length === 0 && (
        <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="py-14 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center"><Inbox className="h-7 w-7 text-muted-foreground/60" /></div>
            <p className="text-base font-medium text-foreground">No projects assigned to your account</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Ask an administrator to assign projects to you under <span className="font-medium text-foreground">User Management → Projects</span>.</p>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="bg-card border border-border/70 rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 surface-elevated">
        <div className={cn(
          "flex items-center w-full sm:w-[200px] h-9 rounded-md border bg-background overflow-hidden transition-colors",
          dateError ? "border-destructive" : "border-input hover:border-ring/40 focus-within:border-ring"
        )}>
          <Input
            value={dateText}
            onChange={(e) => handleDateTextChange(e.target.value)}
            onBlur={handleDateBlur}
            placeholder="dd/mm/yyyy"
            inputMode="numeric"
            maxLength={10}
            className="h-full border-0 shadow-none focus-visible:ring-0 font-medium tabular-nums px-3"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Open calendar" className="h-full w-9 flex items-center justify-center border-l border-input bg-muted/30 hover:bg-muted/60 transition-colors">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setDateText(format(d, "dd/MM/yyyy")); setDateError(false); } }} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="hidden sm:block h-6 w-px bg-border/70" />

        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="h-9 w-full sm:w-[280px] bg-background hover:bg-muted/40 transition-colors font-medium data-[placeholder]:font-normal">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{[p.code && `[${p.code}]`, p.name, p.project_group && `— ${p.project_group}`].filter(Boolean).join(" ")}</SelectItem>)}
          </SelectContent>
        </Select>

        {projectId && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-foreground sm:ml-auto" onClick={copyPreviousDay}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />Copy Previous Day
          </Button>
        )}
      </div>

      {/* No project selected */}
      {mastersLoaded && projects.length > 0 && !projectId && (
        <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="py-16 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center"><ClipboardList className="h-8 w-8 text-muted-foreground/60" /></div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Select a project to begin</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">Choose a project from the picker above to load today's manpower register.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No contractors */}
      {projectId && contractors.length === 0 && (
        <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
          <CardContent className="py-14 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center"><Inbox className="h-7 w-7 text-muted-foreground/60" /></div>
            <p className="text-base font-medium text-foreground">No contractors set up yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Add contractors under <span className="font-medium text-foreground">Masters → Contractors</span> with their nature of work to populate this register.</p>
          </CardContent>
        </Card>
      )}

      {/* Spreadsheet */}
      {projectId && contractors.length > 0 && categories.length > 0 && (
        <Card className="overflow-hidden border border-border/70 rounded-xl shadow-none surface-elevated">
          <CardContent className="p-0">
            <SpreadsheetGrid
              groupedCategories={groupedCategories}
              flatCategories={flatCategories}
              groupedContractors={groupedContractors}
              cells={cells}
              extras={extras}
              setCell={setCell}
              setExtra={setExtra}
              rowTotal={rowTotal}
              colTotal={colTotal}
              grandTotal={grandTotal}
              securityTotal={securityTotal}
            />
          </CardContent>
        </Card>
      )}

      {/* Save bar */}
      {projectId && contractors.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width,16rem)] z-30 border-t border-border/70 bg-background/85 backdrop-blur-md px-4 md:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="absolute top-0 left-0 right-0 h-px hairline-x-primary" aria-hidden />
          <div className="flex items-center justify-between gap-4 w-full max-w-screen-2xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total <span className="font-semibold text-foreground tabular-nums">{grandTotal}</span></span>
              <span className="text-border">·</span>
              <span>Security <span className="font-semibold text-foreground tabular-nums">{securityTotal}</span></span>
              <span className="text-border hidden sm:inline">·</span>
              <span className="hidden sm:inline">{format(date, "dd MMM yyyy")}</span>
            </div>
            <Button onClick={save} disabled={saving} className="shadow-sm hover:shadow transition-shadow">
              <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save Entries"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Spreadsheet Grid ───────────────────────── */

interface GridProps {
  groupedCategories: { group: string; cats: any[] }[];
  flatCategories: any[];
  groupedContractors: { name: string; list: any[] }[];
  cells: CellMap;
  extras: ExtraMap;
  setCell: (contractorId: string, categoryId: string, value: number) => void;
  setExtra: (contractorId: string, field: "security" | "deficiency" | "remarks", value: any) => void;
  rowTotal: (contractorId: string) => number;
  colTotal: (categoryId: string) => number;
  grandTotal: number;
  securityTotal: number;
}

const GROUP_BG: Record<string, string> = {
  CIVIL: "bg-sky-100 dark:bg-sky-950/30 text-sky-900 dark:text-sky-100",
  MEP: "bg-blue-100 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100",
  NMR: "bg-orange-100 dark:bg-orange-950/30 text-orange-900 dark:text-orange-100",
  OTHER: "bg-muted text-muted-foreground",
};

function SpreadsheetGrid({
  groupedCategories, flatCategories, groupedContractors,
  cells, extras, setCell, setExtra,
  rowTotal, colTotal, grandTotal, securityTotal,
}: GridProps) {
  // sl no counter
  let sl = 0;

  const cellClass = "border-r border-b border-border/60 px-1 py-0.5 text-center tabular-nums";
  const stickyText = "bg-card";

  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full text-[12px] border-collapse">
        <thead>
          {/* Top group row */}
          <tr>
            <th rowSpan={2} className={cn("sticky left-0 z-20 bg-muted/60 border-r border-b border-border/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground w-10", stickyText)}>Sl.no</th>
            <th rowSpan={2} className={cn("sticky left-10 z-20 bg-muted/60 border-r border-b border-border/60 px-2 py-1 text-left text-[11px] font-semibold text-muted-foreground min-w-[200px]", stickyText)}>Name of the Contractor</th>
            <th rowSpan={2} className="bg-muted/60 border-r border-b border-border/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground min-w-[110px]">Contact No</th>
            <th rowSpan={2} className="bg-muted/60 border-r border-b border-border/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground min-w-[160px] text-left">Work Place</th>
            {groupedCategories.map((g) => (
              <th key={g.group} colSpan={g.cats.length} className={cn("border-r border-b border-border/60 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wide", GROUP_BG[g.group] || GROUP_BG.OTHER)}>
                {GROUP_LABELS[g.group] || g.group}
              </th>
            ))}
            <th rowSpan={2} className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 border-r border-b border-border/60 px-2 py-1 text-[11px] font-bold uppercase w-16">Total</th>
            <th rowSpan={2} className="bg-muted/60 border-r border-b border-border/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground w-20">Security</th>
            <th rowSpan={2} className="bg-muted/60 border-r border-b border-border/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground w-24">Deficiency<br />Manpower</th>
            <th rowSpan={2} className="bg-muted/60 border-b border-border/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground min-w-[180px] text-left">Remarks</th>
          </tr>
          {/* Sub-header per category */}
          <tr>
            {groupedCategories.flatMap((g) =>
              g.cats.map((c) => (
                <th key={c.id} className={cn("border-r border-b border-border/60 px-1.5 py-1 text-center text-[10.5px] font-semibold min-w-[58px]", GROUP_BG[g.group] || GROUP_BG.OTHER, "bg-opacity-50")}>
                  {c.name}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {groupedContractors.map((g) => (
            <FragmentGroup
              key={g.name}
              group={g}
              flatCategories={flatCategories}
              cells={cells}
              extras={extras}
              setCell={setCell}
              setExtra={setExtra}
              rowTotal={rowTotal}
              slStart={sl}
              advanceSl={(n) => { sl += n; }}
              colSpan={4 + flatCategories.length + 4}
            />
          ))}

          {/* Grand totals row */}
          <tr className="bg-yellow-200 dark:bg-yellow-900/40 font-bold">
            <td className={cn("sticky left-0 z-10 bg-yellow-200 dark:bg-yellow-900/40 border-r border-b border-border/60 px-2 py-1.5 text-center")}></td>
            <td className={cn("sticky left-10 z-10 bg-yellow-200 dark:bg-yellow-900/40 border-r border-b border-border/60 px-2 py-1.5 text-right uppercase text-[11px]")} colSpan={1}>TOTAL</td>
            <td className="border-r border-b border-border/60" />
            <td className="border-r border-b border-border/60" />
            {flatCategories.map((cat) => (
              <td key={cat.id} className={cn(cellClass, "py-1.5 font-bold")}>{colTotal(cat.id) || ""}</td>
            ))}
            <td className={cn(cellClass, "py-1.5 bg-emerald-200 dark:bg-emerald-900/40")}>{grandTotal || ""}</td>
            <td className={cn(cellClass, "py-1.5")}>{securityTotal || ""}</td>
            <td className="border-r border-b border-border/60" />
            <td className="border-b border-border/60" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface FragmentGroupProps {
  group: { name: string; list: any[] };
  flatCategories: any[];
  cells: CellMap;
  extras: ExtraMap;
  setCell: (c: string, cat: string, v: number) => void;
  setExtra: (c: string, f: "security" | "deficiency" | "remarks", v: any) => void;
  rowTotal: (c: string) => number;
  slStart: number;
  advanceSl: (n: number) => void;
  colSpan: number;
}

function FragmentGroup({ group, flatCategories, cells, extras, setCell, setExtra, rowTotal, slStart, advanceSl, colSpan }: FragmentGroupProps) {
  advanceSl(group.list.length);
  return (
    <>
      {/* Band header for nature_of_work */}
      <tr>
        <td colSpan={colSpan} className="bg-amber-100/70 dark:bg-amber-950/30 border-y border-border/60 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100 sticky left-0">
          {group.name}
        </td>
      </tr>
      {group.list.map((c, idx) => {
        const sl = slStart + idx + 1;
        const ex = extras[c.id] || { security: 0, deficiency: 0, remarks: "" };
        const total = rowTotal(c.id);
        return (
          <tr key={c.id} className="hover:bg-muted/30 group">
            <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 border-r border-b border-border/60 px-2 py-1 text-center text-muted-foreground tabular-nums w-10">{sl}</td>
            <td className="sticky left-10 z-10 bg-card group-hover:bg-muted/30 border-r border-b border-border/60 px-2 py-1 text-left font-medium min-w-[200px]">{c.company_name}</td>
            <td className="border-r border-b border-border/60 px-2 py-1 text-center text-muted-foreground tabular-nums">{c.contact_number || ""}</td>
            <td className="border-r border-b border-border/60 px-2 py-1 text-left text-muted-foreground">{c.work_place || ""}</td>
            {flatCategories.map((cat) => {
              const v = cells[`${c.id}:${cat.id}`] || 0;
              return (
                <td key={cat.id} className="border-r border-b border-border/60 p-0 text-center min-w-[58px]">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={v || ""}
                    onChange={(e) => setCell(c.id, cat.id, parseInt(e.target.value) || 0)}
                    className="w-full h-7 text-center tabular-nums bg-transparent border-0 outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/40 px-1"
                  />
                </td>
              );
            })}
            <td className="border-r border-b border-border/60 px-1 py-1 text-center font-bold tabular-nums bg-emerald-50/60 dark:bg-emerald-950/20">{total || ""}</td>
            <td className="border-r border-b border-border/60 p-0">
              <input
                type="number" inputMode="numeric" min={0}
                value={ex.security || ""}
                onChange={(e) => setExtra(c.id, "security", parseInt(e.target.value) || 0)}
                className="w-full h-7 text-center tabular-nums bg-transparent border-0 outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/40 px-1"
              />
            </td>
            <td className="border-r border-b border-border/60 p-0">
              <input
                type="number" inputMode="numeric" min={0}
                value={ex.deficiency || ""}
                onChange={(e) => setExtra(c.id, "deficiency", parseInt(e.target.value) || 0)}
                className="w-full h-7 text-center tabular-nums bg-transparent border-0 outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/40 px-1"
              />
            </td>
            <td className="border-b border-border/60 p-0 min-w-[180px]">
              <input
                type="text"
                value={ex.remarks}
                onChange={(e) => setExtra(c.id, "remarks", e.target.value)}
                placeholder=""
                className="w-full h-7 bg-transparent border-0 outline-none focus:bg-primary/5 focus:ring-1 focus:ring-primary/40 px-2 text-left"
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}
