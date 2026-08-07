import { format, addDays, differenceInCalendarDays } from "date-fns";

export type WeeklyContractorRow = {
  contractorId: string;
  code: string;
  name: string;
  nature: string;
  days: { ir: number; nmr: number }[]; // length = N
  totalIR: number;
  totalNMR: number;
  totalWeek: number;
  perWeek: number; // per-day average = total / N
};


export type WeeklyMatrix = {
  project: { id: string; code?: string | null; name: string };
  weekStart: Date; // fromDate
  weekEnd: Date;   // toDate
  days: Date[];    // N dates
  rows: WeeklyContractorRow[];
  totals: {
    days: { ir: number; nmr: number }[];
    totalIR: number;
    totalNMR: number;
    totalWeek: number;
    perWeek: number;
  };
};

export function buildWeeklyMatrix(input: {
  project: { id: string; code?: string | null; name: string };
  fromDate: Date;
  toDate: Date;
  entries: Array<{
    entry_date: string;
    headcount: number | null;
    contractor_id: string | null;
    contractors?: { id: string; company_name: string; contractor_code: string | null } | null;
    departments?: { name: string } | null;
  }>;
}): WeeklyMatrix {
  const { project, fromDate, toDate, entries } = input;
  const rawN = differenceInCalendarDays(toDate, fromDate) + 1;
  const N = Math.max(1, rawN);
  const days = Array.from({ length: N }, (_, i) => addDays(fromDate, i));
  const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
  const weekEnd = days[N - 1];

  const byContractor = new Map<string, WeeklyContractorRow>();
  for (const r of entries) {
    if (!r.contractor_id || !r.contractors) continue;
    const isNmr = /nmr/i.test(r.departments?.name || "");
    const idx = dayKeys.indexOf(r.entry_date);
    if (idx < 0) continue;
    const hc = Number(r.headcount || 0);
    let row = byContractor.get(r.contractor_id);
    if (!row) {
      row = {
        contractorId: r.contractor_id,
        code: r.contractors.contractor_code || "",
        name: r.contractors.company_name,
        days: Array.from({ length: N }, () => ({ ir: 0, nmr: 0 })),
        totalIR: 0,
        totalNMR: 0,
        totalWeek: 0,
        perWeek: 0,
      };
      byContractor.set(r.contractor_id, row);
    }
    if (isNmr) row.days[idx].nmr += hc;
    else row.days[idx].ir += hc;
  }

  const rows = Array.from(byContractor.values());
  for (const row of rows) {
    row.totalIR = row.days.reduce((s, d) => s + d.ir, 0);
    row.totalNMR = row.days.reduce((s, d) => s + d.nmr, 0);
    row.totalWeek = row.totalIR + row.totalNMR;
    row.perWeek = Math.round((row.totalWeek / N) * 100) / 100;
  }
  rows.sort((a, b) => (a.code || "").localeCompare(b.code || "") || a.name.localeCompare(b.name));

  const totals = {
    days: Array.from({ length: N }, (_, i) => ({
      ir: rows.reduce((s, r) => s + r.days[i].ir, 0),
      nmr: rows.reduce((s, r) => s + r.days[i].nmr, 0),
    })),
    totalIR: rows.reduce((s, r) => s + r.totalIR, 0),
    totalNMR: rows.reduce((s, r) => s + r.totalNMR, 0),
    totalWeek: rows.reduce((s, r) => s + r.totalWeek, 0),
    perWeek: 0,
  };
  totals.perWeek = Math.round((totals.totalWeek / N) * 100) / 100;

  return { project, weekStart: fromDate, weekEnd, days, rows, totals };
}

export function weeklyDateRangeLabel(m: WeeklyMatrix): string {
  return `${format(m.weekStart, "dd.MM.yyyy")} to ${format(m.weekEnd, "dd.MM.yyyy")}`;
}
