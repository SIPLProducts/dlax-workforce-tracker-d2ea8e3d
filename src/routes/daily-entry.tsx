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
import { CalendarIcon, Save } from "lucide-react";
import { format, parse as parseDate, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/daily-entry")({
  component: DailyEntryPage,
});

// Fixed column schema as per the register
type ColDef = { key: string; label: string };
type GroupDef = { key: "CIVIL" | "MEP" | "NMR"; label: string; cols: ColDef[]; headerClass: string; cellClass: string };

const GROUPS: GroupDef[] = [
  {
    key: "CIVIL",
    label: "CIVIL - Item rate / Subcontract",
    headerClass: "bg-blue-100 text-blue-900",
    cellClass: "bg-blue-50/40",
    cols: [
      { key: "civil_rod_bending", label: "Rod Bending" },
      { key: "civil_shuttering", label: "Shuttering" },
      { key: "civil_mason", label: "Mason" },
      { key: "civil_scaffolders", label: "Scaffolders" },
      { key: "civil_painters", label: "Painters" },
      { key: "civil_helpers", label: "Helpers" },
    ],
  },
  {
    key: "MEP",
    label: "MEP - Item rate / Subcontract",
    headerClass: "bg-emerald-100 text-emerald-900",
    cellClass: "bg-emerald-50/40",
    cols: [
      { key: "mep_plumbers", label: "Plumbers" },
      { key: "mep_carpenters", label: "Carpenters" },
      { key: "mep_fitters", label: "Fitters" },
      { key: "mep_welders", label: "Welders" },
      { key: "mep_electricians", label: "Electricians" },
      { key: "mep_helpers", label: "Helpers" },
    ],
  },
  {
    key: "NMR",
    label: "NMR Man powers",
    headerClass: "bg-orange-100 text-orange-900",
    cellClass: "bg-orange-50/40",
    cols: [
      { key: "nmr_mason", label: "Mason" },
      { key: "nmr_mc", label: "M/C" },
      { key: "nmr_fc", label: "F/C" },
    ],
  },
];

const ALL_COLS: ColDef[] = GROUPS.flatMap((g) => g.cols);

type RowData = Record<string, number> & { security: number; deficiency: number; remarks: string; weather: string };
const emptyRow = (): RowData => {
  const r: any = { security: 0, deficiency: 0, remarks: "", weather: "" };
  ALL_COLS.forEach((c) => (r[c.key] = 0));
  return r as RowData;
};

const WEATHER_OPTIONS = [
  "Sunny",
  "Cloudy",
  "Rainy",
  "Heavy Rain",
  "Stormy",
  "Foggy",
  "Hot",
  "Windy",
];

function DailyEntryPage() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [dateText, setDateText] = useState(format(new Date(), "dd/MM/yyyy"));
  const [dateError, setDateError] = useState(false);

  const [projects, setProjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [contractors, setContractors] = useState<{ id: string; company_name: string; contact_number: string | null; work_place: string | null }[]>([]);
  const [rows, setRows] = useState<Record<string, RowData>>({});
  const [statuses, setStatuses] = useState<Record<string, { status: string; rejection?: string | null }>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (parsed) {
      setDate(parsed);
      setDateError(false);
    } else {
      setDateError(raw.length > 0);
    }
  };

  // Load projects
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects").select("id,name,code").order("name");
      setProjects(data || []);
      if (data && data.length && !projectId) setProjectId(data[0].id);
    })();
  }, []);

  // Load contractors + subscribe to realtime updates
  useEffect(() => {
    const fetchContractors = async () => {
      const { data } = await supabase
        .from("contractors")
        .select("id,company_name,contact_number,work_place")
        .order("company_name");
      setContractors(data || []);
    };
    fetchContractors();

    const channel = supabase
      .channel("contractors-daily-entry")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contractors" },
        () => fetchContractors()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Initialize rows when contractors change
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, RowData> = {};
      contractors.forEach((c) => (next[c.id] = prev[c.id] || emptyRow()));
      return next;
    });
  }, [contractors]);

  // Load existing daily_manpower for this date+project; map remarks JSON into typed columns
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("daily_manpower")
        .select("contractor_id,headcount,security_count,deficiency_manpower,remarks,weather_condition,status,rejection_remarks")
        .eq("project_id", projectId)
        .eq("entry_date", format(date, "yyyy-MM-dd"));
      setLoading(false);
      if (error) return;
      const next: Record<string, RowData> = {};
      const stat: Record<string, { status: string; rejection?: string | null }> = {};
      contractors.forEach((c) => (next[c.id] = emptyRow()));
      (data || []).forEach((rec: any) => {
        const r = next[rec.contractor_id] || emptyRow();
        r.security = rec.security_count || 0;
        r.deficiency = rec.deficiency_manpower || 0;
        try {
          const parsed = rec.remarks ? JSON.parse(rec.remarks) : null;
          if (parsed && typeof parsed === "object") {
            r.remarks = parsed._remarks || "";
            ALL_COLS.forEach((c) => {
              if (typeof parsed[c.key] === "number") (r as any)[c.key] = parsed[c.key];
            });
          } else if (typeof rec.remarks === "string") {
            r.remarks = rec.remarks;
          }
        } catch {
          r.remarks = rec.remarks || "";
        }
        r.weather = rec.weather_condition || "";
        next[rec.contractor_id] = r;
        stat[rec.contractor_id] = { status: rec.status, rejection: rec.rejection_remarks };
      });
      setRows(next);
      setStatuses(stat);
    })();
  }, [projectId, date, contractors]);

  const updateCell = (cid: string, key: string, val: number) => {
    setRows((prev) => ({ ...prev, [cid]: { ...prev[cid], [key]: val } as RowData }));
  };
  const updateField = (cid: string, key: "security" | "deficiency" | "remarks" | "weather", val: any) => {
    setRows((prev) => ({ ...prev, [cid]: { ...prev[cid], [key]: val } as RowData }));
  };

  const rowTotal = (r: RowData) => ALL_COLS.reduce((s, c) => s + (Number((r as any)[c.key]) || 0), 0);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = { security: 0, deficiency: 0, total: 0 };
    ALL_COLS.forEach((c) => (t[c.key] = 0));
    contractors.forEach((c) => {
      const r = rows[c.id];
      if (!r) return;
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
    setSaving(true);
    const entry_date = format(date, "yyyy-MM-dd");

    // Strategy: one daily_manpower row per contractor; store all per-trade counts inside remarks as JSON.
    // headcount = sum of all categories. Use a sentinel category/department: pick the first available.
    const { data: cats } = await supabase.from("worker_categories").select("id").limit(1);
    const { data: deps } = await supabase.from("departments").select("id").limit(1);
    const fallbackCat = cats?.[0]?.id;
    const fallbackDep = deps?.[0]?.id;
    if (!fallbackCat || !fallbackDep) {
      setSaving(false);
      return toast.error("Add at least one Department and Category in Masters first");
    }

    // Wipe existing rows for date+project, then insert fresh
    await supabase.from("daily_manpower").delete().eq("project_id", projectId).eq("entry_date", entry_date);

    const inserts = contractors
      .map((c) => {
        const r = rows[c.id];
        if (!r) return null;
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
          submitted_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (inserts.length === 0) {
      setSaving(false);
      return toast.success("Saved (no entries)");
    }

    const { error } = await supabase.from("daily_manpower").insert(inserts as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Daily entry saved");
  };

  const numCell = (val: number, onChange: (n: number) => void, extraClass = "") => (
    <input
      type="number"
      min={0}
      value={val || ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={cn(
        "w-full h-9 px-1 text-center text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary/40",
        extraClass
      )}
    />
  );

  return (
    <div className="p-4 space-y-4 max-w-[100vw]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Daily Manpower Entry</h1>
          <p className="text-sm text-muted-foreground">Daily Labour Attendance Register</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Date</label>
            <div className="flex gap-1">
              <Input
                value={dateText}
                onChange={(e) => handleDateTextChange(e.target.value)}
                placeholder="dd/MM/yyyy"
                className={cn("w-36", dateError && "border-destructive")}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon"><CalendarIcon className="w-4 h-4" /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setDateText(format(d, "dd/MM/yyyy")); setDateError(false); } }} initialFocus />
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TableWithTopScroll>
            <table className="border-collapse text-xs w-full min-w-[1600px]">
            <thead>
              {/* Group super-header */}
              <tr>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-0 z-20 w-12">Sl.no</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 sticky left-12 z-20 min-w-[200px] text-left">Name of the Contractor</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[110px]">Contact No</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[140px]">Work Place</th>
                {GROUPS.map((g) => (
                  <th key={g.key} colSpan={g.cols.length} className={cn("border px-2 py-1 text-center font-semibold", g.headerClass)}>
                    {g.label}
                  </th>
                ))}
                <th rowSpan={2} className="border bg-green-100 text-green-900 px-2 py-2 min-w-[60px]">Total</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[70px]">Security</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[90px]">Deficieny<br/>Manpower</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[160px]">Remarks</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[130px]">Weather</th>
                <th rowSpan={2} className="border bg-slate-100 px-2 py-2 min-w-[120px]">Status</th>
              </tr>
              <tr>
                {GROUPS.flatMap((g) =>
                  g.cols.map((c) => (
                    <th key={c.key} className={cn("border px-1 py-1 text-center font-medium min-w-[64px]", g.headerClass)}>
                      {c.label}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4 + ALL_COLS.length + 6} className="text-center py-6 text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && contractors.length === 0 && (
                <tr><td colSpan={4 + ALL_COLS.length + 6} className="text-center py-6 text-muted-foreground">No contractors. Add some in Masters → Contractors.</td></tr>
              )}
              {contractors.map((c, idx) => {
                const r = rows[c.id] || emptyRow();
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="border text-center sticky left-0 bg-background z-10">{idx + 1}</td>
                    <td className="border px-2 sticky left-12 bg-background z-10 font-medium">{c.company_name}</td>
                    <td className="border px-2 text-center">{c.contact_number || ""}</td>
                    <td className="border px-2">{c.work_place || ""}</td>
                    {GROUPS.map((g) =>
                      g.cols.map((col) => (
                        <td key={col.key} className={cn("border", g.cellClass)}>
                          {numCell((r as any)[col.key] || 0, (n) => updateCell(c.id, col.key, n))}
                        </td>
                      ))
                    )}
                    <td className="border bg-green-50 text-center font-semibold">{rowTotal(r) || ""}</td>
                    <td className="border">{numCell(r.security, (n) => updateField(c.id, "security", n))}</td>
                    <td className="border">{numCell(r.deficiency, (n) => updateField(c.id, "deficiency", n))}</td>
                    <td className="border">
                      <input
                        value={r.remarks}
                        onChange={(e) => updateField(c.id, "remarks", e.target.value)}
                        className="w-full h-9 px-2 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </td>
                    <td className="border">
                      <Select value={r.weather || undefined} onValueChange={(v) => updateField(c.id, "weather", v)}>
                        <SelectTrigger className="h-9 border-0 bg-transparent rounded-none focus:ring-2 focus:ring-primary/40 min-w-[120px]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEATHER_OPTIONS.map((w) => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border px-2 text-xs text-center" title={statuses[c.id]?.rejection || ""}>
                      {(() => {
                        const s = statuses[c.id]?.status;
                        if (!s) return <span className="text-muted-foreground">—</span>;
                        const m: Record<string, string> = {
                          pending_l1: "bg-amber-100 text-amber-900",
                          pending_l2: "bg-blue-100 text-blue-900",
                          approved: "bg-emerald-100 text-emerald-900",
                          rejected: "bg-red-100 text-red-900",
                        };
                        const lbl: Record<string, string> = {
                          pending_l1: "Pending L1",
                          pending_l2: "Pending L2",
                          approved: "Approved",
                          rejected: "Rejected",
                        };
                        return <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium", m[s])}>{lbl[s] || s}</span>;
                      })()}
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
                  {ALL_COLS.map((c) => (
                    <td key={c.key} className="border text-center">{colTotals[c.key] || ""}</td>
                  ))}
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
    </div>
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

  const syncFromTop = () => {
    if (topRef.current && bottomRef.current) bottomRef.current.scrollLeft = topRef.current.scrollLeft;
  };
  const syncFromBottom = () => {
    if (topRef.current && bottomRef.current) topRef.current.scrollLeft = bottomRef.current.scrollLeft;
  };

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
