import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileDown, FileSpreadsheet } from "lucide-react";
import { format, parse as parseDate, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/reports/consolidated")({
  component: () => <AuthGuard><ConsolidatedReportPage /></AuthGuard>,
});

type ReportRow = {
  project_id: string;
  project_name: string;
  civil_masons: number;
  civil_carpenters: number;
  civil_steel: number;
  civil_painters: number;
  civil_helpers: number;
  mep_skilled: number;
  mep_helpers: number;
  nmr_mason: number;
  nmr_helpers_m: number;
  nmr_helpers_f: number;
  security: number;
};

const COLS: { key: keyof ReportRow; label: string }[] = [
  { key: "civil_masons", label: "Masons" },
  { key: "civil_carpenters", label: "Carpenters" },
  { key: "civil_steel", label: "Steel Fixers" },
  { key: "civil_painters", label: "Painters" },
  { key: "civil_helpers", label: "Helpers" },
  { key: "mep_skilled", label: "Skilled" },
  { key: "mep_helpers", label: "Helpers" },
  { key: "nmr_mason", label: "Mason" },
  { key: "nmr_helpers_m", label: "Helpers (M)" },
  { key: "nmr_helpers_f", label: "Helpers (F)" },
];

// Map worker_category NAME (lowercased) → bucket key on ReportRow.
// Covers both legacy single-category rows AND new JSON-in-remarks model.
const CATEGORY_TO_BUCKET: Record<string, keyof ReportRow> = {
  // Civil
  "mason": "civil_masons",
  "masons": "civil_masons",
  "carpenters": "civil_carpenters",
  "carpenter": "civil_carpenters",
  "shuttering": "civil_carpenters",
  "scaffolders": "civil_carpenters",
  "rod bending": "civil_steel",
  "steel fixers": "civil_steel",
  "painters": "civil_painters",
  "helpers": "civil_helpers",
  // MEP
  "plumbers": "mep_skilled",
  "fitters": "mep_skilled",
  "welders": "mep_skilled",
  "electricians": "mep_skilled",
  "skilled": "mep_skilled",
  "mep helpers": "mep_helpers",
  // NMR
  "nmr mason": "nmr_mason",
  "m/c": "nmr_helpers_m",
  "f /c": "nmr_helpers_f",
  "f/c": "nmr_helpers_f",
};

// New JSON-in-remarks key → bucket
const JSON_KEY_TO_BUCKET: Record<string, keyof ReportRow> = {
  civil_mason: "civil_masons",
  civil_shuttering: "civil_carpenters",
  civil_scaffolders: "civil_carpenters",
  civil_rod_bending: "civil_steel",
  civil_painters: "civil_painters",
  civil_helpers: "civil_helpers",
  mep_plumbers: "mep_skilled",
  mep_carpenters: "mep_skilled",
  mep_fitters: "mep_skilled",
  mep_welders: "mep_skilled",
  mep_electricians: "mep_skilled",
  mep_helpers: "mep_helpers",
  nmr_mason: "nmr_mason",
  nmr_mc: "nmr_helpers_m",
  nmr_fc: "nmr_helpers_f",
};

function ConsolidatedReportPage() {
  const today = new Date();
  const [date, setDate] = useState<Date>(today);
  const [dateText, setDateText] = useState(format(today, "dd/MM/yyyy"));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [planned, setPlanned] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const tryParseDate = (s: string): Date | null => {
    for (const f of ["dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "d/M/yyyy", "d-M-yyyy"]) {
      const d = parseDate(s, f, new Date());
      if (isValid(d)) return d;
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: projects }, { data: cats }, { data: mp }] = await Promise.all([
        supabase.from("projects").select("id,name").order("name"),
        supabase.from("worker_categories").select("id,name"),
        supabase
          .from("daily_manpower")
          .select("project_id,category_id,headcount,security_count,remarks")
          .eq("entry_date", format(date, "yyyy-MM-dd")),
      ]);
      if (cancelled) return;

      const catMap: Record<string, string> = {};
      (cats || []).forEach((c: any) => (catMap[c.id] = (c.name || "").toLowerCase().trim()));

      const byProject: Record<string, ReportRow> = {};
      (projects || []).forEach((p: any) => {
        byProject[p.id] = {
          project_id: p.id, project_name: p.name,
          civil_masons: 0, civil_carpenters: 0, civil_steel: 0,
          civil_painters: 0, civil_helpers: 0,
          mep_skilled: 0, mep_helpers: 0,
          nmr_mason: 0, nmr_helpers_m: 0, nmr_helpers_f: 0,
          security: 0,
        };
      });

      (mp || []).forEach((rec: any) => {
        const r = byProject[rec.project_id];
        if (!r) return;

        // 1) Try parsing remarks as JSON (new format)
        let parsed: any = null;
        try { parsed = rec.remarks ? JSON.parse(rec.remarks) : null; } catch { /* not JSON */ }

        if (parsed && typeof parsed === "object") {
          Object.entries(JSON_KEY_TO_BUCKET).forEach(([k, bucket]) => {
            const v = Number(parsed[k]) || 0;
            if (v) (r as any)[bucket] += v;
          });
        } else {
          // 2) Legacy: one row per category, headcount has the count
          const catName = catMap[rec.category_id];
          const bucket = catName ? CATEGORY_TO_BUCKET[catName] : undefined;
          if (bucket) (r as any)[bucket] += Number(rec.headcount) || 0;
        }
        r.security += Number(rec.security_count) || 0;
      });

      setRows(Object.values(byProject));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [date]);

  const computed = useMemo(() => rows.map((r) => {
    const subTotal = r.civil_masons + r.civil_carpenters + r.civil_steel + r.civil_painters + r.civil_helpers + r.mep_skilled + r.mep_helpers;
    const nmrTotal = r.nmr_mason + r.nmr_helpers_m + r.nmr_helpers_f;
    const total = subTotal + nmrTotal;
    const plannedNmr = Number(planned[r.project_id]) || 0;
    const nmrPctTotal = total > 0 ? (nmrTotal / total) * 100 : 0;
    const nmrPctPlanned = plannedNmr > 0 ? (nmrTotal / plannedNmr) * 100 : 0;
    return { ...r, subTotal, nmrTotal, total, plannedNmr, nmrPctTotal, nmrPctPlanned };
  }), [rows, planned]);

  const totals = useMemo(() => {
    const t: any = { civil_masons: 0, civil_carpenters: 0, civil_steel: 0, civil_painters: 0, civil_helpers: 0, mep_skilled: 0, mep_helpers: 0, nmr_mason: 0, nmr_helpers_m: 0, nmr_helpers_f: 0, subTotal: 0, nmrTotal: 0, total: 0, plannedNmr: 0, security: 0 };
    computed.forEach((r) => { Object.keys(t).forEach((k) => { t[k] += (r as any)[k] || 0; }); });
    t.nmrPctTotal = t.total > 0 ? (t.nmrTotal / t.total) * 100 : 0;
    t.nmrPctPlanned = t.plannedNmr > 0 ? (t.nmrTotal / t.plannedNmr) * 100 : 0;
    return t;
  }, [computed]);

  const exportExcel = () => {
    const data = computed.map((r) => ({
      "Project": r.project_name,
      "Civil-Masons (Tiles, Granite, Brickwork, Glazing)": r.civil_masons,
      "Civil-Carpenters (Shuttering, Scaffolding, Wood)": r.civil_carpenters,
      "Civil-Steel Fixers (Fabricator, Rod benders)": r.civil_steel,
      "Civil-Painters": r.civil_painters,
      "Civil-Helpers": r.civil_helpers,
      "MEP-Skilled": r.mep_skilled,
      "MEP-Helpers": r.mep_helpers,
      "NMR-Mason": r.nmr_mason,
      "NMR-Helpers (M)": r.nmr_helpers_m,
      "NMR-Helpers (F)": r.nmr_helpers_f,
      "Sub Contractors/Job Work Total": r.subTotal,
      "NMR Total": r.nmrTotal,
      "Total": r.total,
      "NMR % on Total": r.nmrPctTotal.toFixed(1) + "%",
      "NMR Planned (per day)": r.plannedNmr,
      "NMR % on Planned": r.nmrPctPlanned.toFixed(1) + "%",
      "Security": r.security,
      "Remarks": remarks[r.project_id] || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidated");
    XLSX.writeFile(wb, `Consolidated_${format(date, "yyyy-MM-dd")}.xlsx`);
    toast.success("Exported");
  };

  const cell = "border px-2 py-1 text-center text-xs";
  const head = "border px-2 py-1 text-center text-xs font-semibold";

  const hasAnyData = computed.some((r) => r.total > 0 || r.security > 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Consolidated Report</h1>
            <p className="text-sm text-muted-foreground">Project × Trade cross-tab — Sub Contractors/Job Works vs NMR for the selected date</p>
          </div>
        </div>
        <Button onClick={exportExcel}><FileDown className="w-4 h-4 mr-2" />Export Excel</Button>
      </div>

      <Card>
        <CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs font-medium">Report Date</label>
            <div className="flex gap-1">
              <Input
                value={dateText}
                onChange={(e) => {
                  setDateText(e.target.value);
                  const d = tryParseDate(e.target.value);
                  if (d) setDate(d);
                }}
                placeholder="dd/MM/yyyy"
                className="w-36"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon"><CalendarIcon className="w-4 h-4" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setDateText(format(d, "dd/MM/yyyy")); } }} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {!loading && !hasAnyData && (
            <p className="text-xs text-muted-foreground ml-auto">No manpower entries for this date. Pick another date or add entries on Daily Entry.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="border-collapse text-xs w-full min-w-[1900px]">
            <thead>
              <tr>
                <th rowSpan={3} className={cn(head, "bg-slate-100 min-w-[200px] text-left")}>Name of the Project</th>
                <th colSpan={7} className={cn(head, "bg-blue-100 text-blue-900")}>Sub Contractors/Job Works</th>
                <th colSpan={3} className={cn(head, "bg-orange-100 text-orange-900")}>NMR</th>
                <th colSpan={2} className={cn(head, "bg-emerald-100 text-emerald-900")}>Total Labour</th>
                <th rowSpan={3} className={cn(head, "bg-green-100 text-green-900 min-w-[60px]")}>Total</th>
                <th rowSpan={3} className={cn(head, "bg-slate-100 min-w-[80px]")}>NMR % on Total</th>
                <th rowSpan={3} className={cn(head, "bg-yellow-50 min-w-[100px]")}>NMR (no.s) per day as per planned</th>
                <th rowSpan={3} className={cn(head, "bg-slate-100 min-w-[80px]")}>NMR % on no.s planned</th>
                <th rowSpan={3} className={cn(head, "bg-slate-100 min-w-[70px]")}>Security</th>
                <th rowSpan={3} className={cn(head, "bg-slate-100 min-w-[160px]")}>Remarks</th>
              </tr>
              <tr>
                <th colSpan={5} className={cn(head, "bg-blue-50 text-blue-900")}>Civil</th>
                <th colSpan={2} className={cn(head, "bg-blue-50 text-blue-900")}>MEP</th>
                <th rowSpan={2} className={cn(head, "bg-orange-50 text-orange-900 min-w-[60px]")}>Mason</th>
                <th rowSpan={2} className={cn(head, "bg-orange-50 text-orange-900 min-w-[70px]")}>Helpers (M)</th>
                <th rowSpan={2} className={cn(head, "bg-orange-50 text-orange-900 min-w-[70px]")}>Helpers (F)</th>
                <th rowSpan={2} className={cn(head, "bg-emerald-50 text-emerald-900 min-w-[90px]")}>Sub Contractors / Job Work</th>
                <th rowSpan={2} className={cn(head, "bg-emerald-50 text-emerald-900 min-w-[60px]")}>NMR</th>
              </tr>
              <tr>
                <th className={cn(head, "bg-blue-50 min-w-[110px]")}>Masons<br /><span className="font-normal text-[10px] text-muted-foreground">Tiles, Granite, Brickwork, Glazing</span></th>
                <th className={cn(head, "bg-blue-50 min-w-[110px]")}>Carpenters<br /><span className="font-normal text-[10px] text-muted-foreground">Shuttering, Scaffolding, Wood works</span></th>
                <th className={cn(head, "bg-blue-50 min-w-[110px]")}>Steel Fixers<br /><span className="font-normal text-[10px] text-muted-foreground">Fabricator works, Rod benders</span></th>
                <th className={cn(head, "bg-blue-50 min-w-[70px]")}>Painters</th>
                <th className={cn(head, "bg-blue-50 min-w-[70px]")}>Helpers</th>
                <th className={cn(head, "bg-blue-50 min-w-[70px]")}>Skilled</th>
                <th className={cn(head, "bg-blue-50 min-w-[70px]")}>Helpers</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={19} className="text-center py-6 text-muted-foreground">Loading…</td></tr>)}
              {!loading && computed.length === 0 && (<tr><td colSpan={19} className="text-center py-6 text-muted-foreground">No projects found.</td></tr>)}
              {computed.map((r) => (
                <tr key={r.project_id} className="hover:bg-muted/30">
                  <td className="border px-2 py-1 text-xs font-medium">{r.project_name}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className={cell}>{(r as any)[c.key] || ""}</td>
                  ))}
                  <td className={cn(cell, "bg-emerald-50 font-semibold")}>{r.subTotal || ""}</td>
                  <td className={cn(cell, "bg-emerald-50 font-semibold")}>{r.nmrTotal || ""}</td>
                  <td className={cn(cell, "bg-green-50 font-bold")}>{r.total || ""}</td>
                  <td className={cell}>{r.total > 0 ? r.nmrPctTotal.toFixed(1) + "%" : ""}</td>
                  <td className={cell}>
                    <input
                      type="number"
                      min={0}
                      value={planned[r.project_id] || ""}
                      onChange={(e) => setPlanned((p) => ({ ...p, [r.project_id]: Number(e.target.value) || 0 }))}
                      className="w-20 h-7 px-1 text-center bg-transparent border rounded"
                    />
                  </td>
                  <td className={cell}>{r.plannedNmr > 0 ? r.nmrPctPlanned.toFixed(1) + "%" : ""}</td>
                  <td className={cell}>{r.security || ""}</td>
                  <td className={cell}>
                    <input
                      value={remarks[r.project_id] || ""}
                      onChange={(e) => setRemarks((p) => ({ ...p, [r.project_id]: e.target.value }))}
                      className="w-full h-7 px-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            {computed.length > 0 && (
              <tfoot>
                <tr className="bg-yellow-100 font-bold">
                  <td className="border px-2 py-1">TOTAL</td>
                  {COLS.map((c) => (<td key={c.key} className={cell}>{totals[c.key] || ""}</td>))}
                  <td className={cn(cell, "bg-emerald-100")}>{totals.subTotal || ""}</td>
                  <td className={cn(cell, "bg-emerald-100")}>{totals.nmrTotal || ""}</td>
                  <td className={cn(cell, "bg-green-200")}>{totals.total || ""}</td>
                  <td className={cell}>{totals.total > 0 ? totals.nmrPctTotal.toFixed(1) + "%" : ""}</td>
                  <td className={cell}>{totals.plannedNmr || ""}</td>
                  <td className={cell}>{totals.plannedNmr > 0 ? totals.nmrPctPlanned.toFixed(1) + "%" : ""}</td>
                  <td className={cell}>{totals.security || ""}</td>
                  <td className={cell}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
