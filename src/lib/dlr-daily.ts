import * as XLSX from "xlsx";
import { format } from "date-fns";

export type DlrCategory = { id: string; name: string };
export type DlrDept = { name: string; categories: DlrCategory[] };

export type DlrInput = {
  project: { id: string; code?: string | null; name: string; project_group?: string | null };
  date: Date;
  rows: any[]; // daily_manpower rows for project+date
  departments: DlrDept[]; // dynamic per-project structure
};

export type HeaderBands = {
  depts: DlrDept[];
  catCols: { id: string; name: string; deptName: string }[];
  catStart: number;
  catWidth: number;
  totalCol: number;
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

const HEADER_ROWS = 3;

function buildBands(departments: DlrDept[]): HeaderBands {
  const depts = departments.filter((d) => d.categories.length > 0);
  const catCols: HeaderBands["catCols"] = [];
  for (const d of depts) for (const c of d.categories) catCols.push({ id: c.id, name: c.name, deptName: d.name });
  const catStart = 2;
  const catWidth = catCols.length;
  const totalCol = catStart + catWidth;
  const remarksCol = totalCol + 1;
  const numCols = remarksCol + 1;
  return { depts, catCols, catStart, catWidth, totalCol, remarksCol, numCols };
}

export function getDlrDailyMatrix({ project, date, rows, departments }: DlrInput): DlrMatrix {
  const dateLabel = format(date, "dd-MM-yyyy");
  const title = `${project.name}${project.code ? ` [${project.code}]` : ""}\nDAILY LABOUR REPORT — ${dateLabel}`;
  const bands = buildBands(departments);
  const NUM = bands.numCols;
  const blank = (): (string | number | null)[] => Array(NUM).fill(null);

  const catTotals: Record<string, number> = {};
  const remarksSet = new Set<string>();
  for (const r of rows) {
    const hc = Number(r.headcount || 0);
    if (r.category_id) catTotals[r.category_id] = (catTotals[r.category_id] || 0) + hc;
    if (r.remarks && String(r.remarks).trim()) remarksSet.add(String(r.remarks).trim());
  }
  const total = bands.catCols.reduce((s, c) => s + (catTotals[c.id] || 0), 0);

  // r0 title
  const r0 = blank(); r0[0] = title;

  // r1: Sl.No | Name | dept names | Total | Remarks
  const r1 = blank();
  r1[0] = "Sl.No.";
  r1[1] = "Name of the Project";
  let cur = bands.catStart;
  for (const d of bands.depts) { r1[cur] = d.name; cur += d.categories.length; }
  r1[bands.totalCol] = "Total";
  r1[bands.remarksCol] = "Remarks";

  // r2: category leaves
  const r2 = blank();
  bands.catCols.forEach((c, i) => { r2[bands.catStart + i] = c.name; });

  const cells: (string | number | null)[][] = [r0, r1, r2];
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
  d[1] = project.name;
  bands.catCols.forEach((c, i) => { d[bands.catStart + i] = catTotals[c.id] || 0; });
  d[bands.totalCol] = total;
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
    { s: { r: 0, c: 0 }, e: { r: 0, c: NUM - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
    { s: { r: 1, c: b.totalCol }, e: { r: 2, c: b.totalCol } },
    { s: { r: 1, c: b.remarksCol }, e: { r: 2, c: b.remarksCol } },
  ];
  let cursor = b.catStart;
  for (const d of b.depts) {
    if (d.categories.length > 1) merges.push({ s: { r: 1, c: cursor }, e: { r: 1, c: cursor + d.categories.length - 1 } });
    cursor += d.categories.length;
  }
  for (const sr of matrix.sectionRows) merges.push({ s: { r: sr, c: 1 }, e: { r: sr, c: NUM - 1 } });
  ws["!merges"] = merges;

  const cols: XLSX.ColInfo[] = [{ wch: 6 }, { wch: 28 }];
  for (let i = 0; i < b.catWidth; i++) cols.push({ wch: 14 });
  cols.push({ wch: 10 });
  cols.push({ wch: 28 });
  ws["!cols"] = cols;
  ws["!rows"] = [{ hpt: 36 }, { hpt: 28 }, { hpt: 28 }];

  const intFmt = '#,##0;(#,##0);"-"';
  for (let r = matrix.headerRows; r < matrix.cells.length; r++) {
    if (matrix.sectionRows.includes(r)) continue;
    for (let c = 2; c < NUM; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (c === b.remarksCol) { /* text */ }
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
