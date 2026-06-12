import * as XLSX from "xlsx";
import { format } from "date-fns";

export type DlrCategory = { id: string; name: string };
export type DlrDept = { name: string; isNmr: boolean; categories: DlrCategory[] };

export type DlrInput = {
  project: { id: string; code?: string | null; name: string; project_group?: string | null };
  date: Date;
  rows: any[]; // daily_manpower joined to contractors, departments, worker_categories
  departments: DlrDept[]; // dynamic per-project structure
};

export type HeaderBands = {
  subDepts: DlrDept[];
  nmrDepts: DlrDept[];
  catCols: { id: string; name: string; deptName: string }[]; // ordered category leaf columns
  subStart: number;   // first dynamic col index (always 2)
  subWidth: number;   // colspan for "Sub Contractors/Job Works" band
  nmrStart: number;
  nmrWidth: number;
  totalLabourStart: number;
  totalCol: number;
  pctTotalCol: number;
  budgetCol: number;
  pctBudgetCol: number;
  securityCol: number;
  remarksCol: number;
  numCols: number;
};

export type DlrMatrix = {
  title: string;
  dateLabel: string;
  bands: HeaderBands;
  cells: (string | number | null)[][];
  headerRows: number;
  sectionRows: number[];
  dataRow: number;
};

const HEADER_ROWS = 4;

function buildBands(departments: DlrDept[]): HeaderBands {
  const subDepts = departments.filter((d) => !d.isNmr && d.categories.length > 0);
  const nmrDepts = departments.filter((d) => d.isNmr && d.categories.length > 0);
  const catCols: HeaderBands["catCols"] = [];
  for (const d of [...subDepts, ...nmrDepts]) {
    for (const c of d.categories) catCols.push({ id: c.id, name: c.name, deptName: d.name });
  }
  const subWidth = subDepts.reduce((s, d) => s + d.categories.length, 0);
  const nmrWidth = nmrDepts.reduce((s, d) => s + d.categories.length, 0);
  const subStart = 2;
  const nmrStart = subStart + subWidth;
  const totalLabourStart = nmrStart + nmrWidth;
  const totalCol = totalLabourStart + 2;
  const pctTotalCol = totalCol + 1;
  const budgetCol = pctTotalCol + 1;
  const pctBudgetCol = budgetCol + 1;
  const securityCol = pctBudgetCol + 1;
  const remarksCol = securityCol + 1;
  const numCols = remarksCol + 1;
  return { subDepts, nmrDepts, catCols, subStart, subWidth, nmrStart, nmrWidth, totalLabourStart, totalCol, pctTotalCol, budgetCol, pctBudgetCol, securityCol, remarksCol, numCols };
}

export function getDlrDailyMatrix({ project, date, rows, departments }: DlrInput): DlrMatrix {
  const dateLabel = format(date, "dd-MM-yyyy");
  const title = `DAILY LABOUR REPORT\n${dateLabel}`;
  const bands = buildBands(departments);
  const NUM = bands.numCols;
  const blank = (): (string | number | null)[] => Array(NUM).fill(null);

  // Aggregate
  const catTotals: Record<string, number> = {};
  let itemRateTotal = 0;
  let nmrTotal = 0;
  const remarksSet = new Set<string>();
  for (const r of rows) {
    const hc = Number(r.headcount || 0);
    const nature = (r.contractors?.nature_of_work || "").toString().trim().toLowerCase();
    if (nature === "nmr") nmrTotal += hc;
    else itemRateTotal += hc;
    if (r.category_id) catTotals[r.category_id] = (catTotals[r.category_id] || 0) + hc;
    if (r.remarks && String(r.remarks).trim()) remarksSet.add(String(r.remarks).trim());
  }
  const total = itemRateTotal + nmrTotal;
  const pctOnTotal = total > 0 ? nmrTotal / total : null;

  // Header rows
  const r1 = blank(); r1[0] = title;
  const r2 = blank();
  r2[0] = "Sl.No.";
  r2[1] = "Name of the Project";
  if (bands.subWidth > 0) r2[bands.subStart] = "Sub Contractors/Job Works";
  if (bands.nmrWidth > 0) r2[bands.nmrStart] = "NMR";
  r2[bands.totalLabourStart] = "Total Labour";
  r2[bands.totalCol] = "Total";
  r2[bands.pctTotalCol] = "NMR % on Total";
  r2[bands.budgetCol] = "Budget NMR";
  r2[bands.pctBudgetCol] = "NMR % on Budget";
  r2[bands.securityCol] = "Security";
  r2[bands.remarksCol] = "Remarks";

  const r3 = blank();
  let cursor = bands.subStart;
  for (const d of bands.subDepts) { r3[cursor] = d.name; cursor += d.categories.length; }
  for (const d of bands.nmrDepts) { r3[cursor] = d.name; cursor += d.categories.length; }

  const r4 = blank();
  bands.catCols.forEach((c, i) => { r4[bands.subStart + i] = c.name; });
  r4[bands.totalLabourStart] = "Sub Contractors/Job Work";
  r4[bands.totalLabourStart + 1] = "NMR";

  const cells: (string | number | null)[][] = [r1, r2, r3, r4];
  const sectionRows: number[] = [];

  if (project.project_group) {
    const sec = blank();
    sec[1] = project.project_group;
    sectionRows.push(cells.length);
    cells.push(sec);
  }

  const dataRow = cells.length;
  const d = blank();
  d[0] = 1;
  d[1] = project.code || project.name;
  bands.catCols.forEach((c, i) => { d[bands.subStart + i] = catTotals[c.id] || 0; });
  d[bands.totalLabourStart] = itemRateTotal;
  d[bands.totalLabourStart + 1] = nmrTotal;
  d[bands.totalCol] = total;
  d[bands.pctTotalCol] = pctOnTotal;
  d[bands.budgetCol] = 0;
  d[bands.pctBudgetCol] = null;
  d[bands.securityCol] = 0;
  d[bands.remarksCol] = remarksSet.size ? Array.from(remarksSet).join("; ") : "";
  cells.push(d);

  return { title, dateLabel, bands, cells, headerRows: HEADER_ROWS, sectionRows, dataRow };
}

export function buildDlrDailyWorkbook(matrix: DlrMatrix): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(matrix.cells);
  const b = matrix.bands;
  const NUM = b.numCols;

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: NUM - 1 } }, // title
    { s: { r: 1, c: 0 }, e: { r: 3, c: 0 } },       // Sl.No
    { s: { r: 1, c: 1 }, e: { r: 3, c: 1 } },       // Name
    { s: { r: 1, c: b.totalLabourStart }, e: { r: 1, c: b.totalLabourStart + 1 } }, // Total Labour
    { s: { r: 2, c: b.totalLabourStart }, e: { r: 2, c: b.totalLabourStart + 1 } }, // empty span row3
    { s: { r: 1, c: b.totalCol }, e: { r: 3, c: b.totalCol } },
    { s: { r: 1, c: b.pctTotalCol }, e: { r: 3, c: b.pctTotalCol } },
    { s: { r: 1, c: b.budgetCol }, e: { r: 3, c: b.budgetCol } },
    { s: { r: 1, c: b.pctBudgetCol }, e: { r: 3, c: b.pctBudgetCol } },
    { s: { r: 1, c: b.securityCol }, e: { r: 3, c: b.securityCol } },
    { s: { r: 1, c: b.remarksCol }, e: { r: 3, c: b.remarksCol } },
  ];
  if (b.subWidth > 0) merges.push({ s: { r: 1, c: b.subStart }, e: { r: 1, c: b.subStart + b.subWidth - 1 } });
  if (b.nmrWidth > 0) merges.push({ s: { r: 1, c: b.nmrStart }, e: { r: 1, c: b.nmrStart + b.nmrWidth - 1 } });
  // dept name spans in row 3
  let cursor = b.subStart;
  for (const d of [...b.subDepts, ...b.nmrDepts]) {
    if (d.categories.length > 1) merges.push({ s: { r: 2, c: cursor }, e: { r: 2, c: cursor + d.categories.length - 1 } });
    cursor += d.categories.length;
  }
  // section rows
  for (const sr of matrix.sectionRows) merges.push({ s: { r: sr, c: 1 }, e: { r: sr, c: NUM - 1 } });
  ws["!merges"] = merges;

  // Column widths
  const cols: XLSX.ColInfo[] = [{ wch: 6 }, { wch: 26 }];
  for (let i = 0; i < b.subWidth + b.nmrWidth; i++) cols.push({ wch: 12 });
  cols.push({ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 28 });
  ws["!cols"] = cols;
  ws["!rows"] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 22 }, { hpt: 36 }];

  // Number formats on data rows
  const intFmt = '#,##0;(#,##0);"-"';
  const pctFmt = "0%";
  for (let r = matrix.headerRows; r < matrix.cells.length; r++) {
    if (matrix.sectionRows.includes(r)) continue;
    for (let c = 2; c < NUM; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (c === b.pctTotalCol || c === b.pctBudgetCol) { cell.t = "n"; cell.z = pctFmt; }
      else if (c === b.remarksCol) { /* text */ }
      else if (typeof cell.v === "number") { cell.t = "n"; cell.z = intFmt; }
    }
  }
  (ws as any)["!views"] = [{ state: "frozen", xSplit: 2, ySplit: matrix.headerRows }];
  XLSX.utils.book_append_sheet(wb, ws, matrix.dateLabel.replace(/-/g, "."));
  return wb;
}

const csvEscape = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildDlrDailyCsv(matrix: DlrMatrix): string {
  const b = matrix.bands;
  return matrix.cells
    .map((row, ri) =>
      row
        .map((v, ci) => {
          if (v === null || v === undefined) return "";
          const isData = ri >= matrix.headerRows && !matrix.sectionRows.includes(ri);
          if (isData && (ci === b.pctTotalCol || ci === b.pctBudgetCol)) {
            return typeof v === "number" ? csvEscape(`${Math.round(v * 100)}%`) : "";
          }
          if (isData && ci >= 2 && ci !== b.remarksCol && typeof v === "number" && v === 0) {
            return csvEscape("-");
          }
          return csvEscape(v);
        })
        .join(",")
    )
    .join("\n");
}

export function downloadDlrXlsx(matrix: DlrMatrix, filename: string) {
  XLSX.writeFile(buildDlrDailyWorkbook(matrix), filename);
}

export function downloadDlrCsv(matrix: DlrMatrix, filename: string) {
  const blob = new Blob([buildDlrDailyCsv(matrix)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
