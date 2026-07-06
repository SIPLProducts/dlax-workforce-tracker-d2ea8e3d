import * as XLSX from "xlsx";
import { format } from "date-fns";

export type DlrCategory = { id: string; name: string };
export type DlrDept = { name: string; isNmr: boolean; categories: DlrCategory[] };

export type DlrInput = {
  project: { id: string; code?: string | null; name: string; project_group?: string | null };
  date: Date;
  rows: any[];
  departments: DlrDept[];
  departmentIds: string[];
};

// Fixed layout (matches Matrix Format):
// 0 Sl.No | 1 Project | 2..(catEnd) category leaves |
// subTotalCol "Sub Contractors/Job Work" | nmrTotalCol "NMR" |
// totalCol "Total" | securityCol "Security" | remarksCol "Remarks"
export type HeaderBands = {
  depts: DlrDept[];
  catCols: { id: string; name: string; deptName: string; isNmr: boolean }[];
  catStart: number;
  catWidth: number;
  subTotalCol: number;
  nmrTotalCol: number;
  totalCol: number;
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
  const depts = departments.filter((d) => d.categories.length > 0);
  const catCols: HeaderBands["catCols"] = [];
  for (const d of depts) for (const c of d.categories) catCols.push({ id: c.id, name: c.name, deptName: d.name, isNmr: d.isNmr });
  const catStart = 2;
  const catWidth = catCols.length;
  const subTotalCol = catStart + catWidth;
  const nmrTotalCol = subTotalCol + 1;
  const totalCol = nmrTotalCol + 1;
  const securityCol = totalCol + 1;
  const remarksCol = securityCol + 1;
  const numCols = remarksCol + 1;
  return { depts, catCols, catStart, catWidth, subTotalCol, nmrTotalCol, totalCol, securityCol, remarksCol, numCols };
}

export function getDlrDailyMatrix({ project, date, rows, departments }: DlrInput): DlrMatrix {
  const dateLabel = format(date, "dd-MM-yyyy");
  const title = `DAILY LABOUR REPORT\n${dateLabel}`;
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

  // r0 title
  const r0 = blank(); r0[0] = title;

  // r1: Sl.No | Name | dept band labels | "Total Labour" | Total | Security | Remarks
  const r1 = blank();
  r1[0] = "Sl.No.";
  r1[1] = "Name of the Project";
  let cur = bands.catStart;
  for (const d of bands.depts) { r1[cur] = d.name; cur += d.categories.length; }
  r1[bands.subTotalCol] = "Total Labour";
  r1[bands.totalCol] = "Total";
  r1[bands.securityCol] = "Security";
  r1[bands.remarksCol] = "Remarks";

  // r2: category leaves label placeholder row (dept bands continue via merge)
  const r2 = blank();
  // r3: category leaf names + Sub/NMR leaves
  const r3 = blank();
  bands.catCols.forEach((c, i) => { r3[bands.catStart + i] = c.name; });
  r3[bands.subTotalCol] = "Sub Contractors/ Job Work";
  r3[bands.nmrTotalCol] = "NMR";

  const cells: (string | number | null)[][] = [r0, r1, r2, r3];
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
  d[1] = project.code ? `[${project.code}] ${project.name}` : project.name;
  let subTotal = 0;
  let nmrTotal = 0;
  bands.catCols.forEach((c, i) => {
    const v = catTotals[c.id] || 0;
    d[bands.catStart + i] = v;
    if (c.isNmr) nmrTotal += v; else subTotal += v;
  });
  d[bands.subTotalCol] = subTotal;
  d[bands.nmrTotalCol] = nmrTotal;
  d[bands.totalCol] = subTotal + nmrTotal;
  d[bands.securityCol] = 0; // no data source in app
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
    { s: { r: 1, c: b.subTotalCol }, e: { r: 2, c: b.nmrTotalCol } }, // Total Labour band over sub+nmr
    { s: { r: 1, c: b.totalCol }, e: { r: 3, c: b.totalCol } },
    { s: { r: 1, c: b.securityCol }, e: { r: 3, c: b.securityCol } },
    { s: { r: 1, c: b.remarksCol }, e: { r: 3, c: b.remarksCol } },
  ];
  // dept band labels row 1 span their category leaves rows 1-2
  let cursor = b.catStart;
  for (const d of b.depts) {
    if (d.categories.length >= 1) {
      merges.push({ s: { r: 1, c: cursor }, e: { r: 2, c: cursor + d.categories.length - 1 } });
    }
    cursor += d.categories.length;
  }
  for (const sr of matrix.sectionRows) merges.push({ s: { r: sr, c: 1 }, e: { r: sr, c: NUM - 1 } });
  ws["!merges"] = merges;

  const cols: XLSX.ColInfo[] = [{ wch: 6 }, { wch: 28 }];
  for (let i = 0; i < b.catWidth; i++) cols.push({ wch: 12 });
  cols.push({ wch: 16 }); // sub
  cols.push({ wch: 10 }); // nmr
  cols.push({ wch: 10 }); // total
  cols.push({ wch: 10 }); // security
  cols.push({ wch: 28 }); // remarks
  ws["!cols"] = cols;
  ws["!rows"] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 18 }, { hpt: 26 }];

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
