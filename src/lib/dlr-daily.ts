import * as XLSX from "xlsx";
import { format } from "date-fns";

export type DlrCategory = { id: string; name: string };
export type DlrDept = { name: string; isNmr: boolean; categories: DlrCategory[] };

export type DlrInput = {
  project: { id: string; code?: string | null; name: string; project_group?: string | null };
  date: Date;
  rows: any[]; // daily_manpower joined to contractors, departments, worker_categories
  departments: DlrDept[]; // dynamic per-project structure
  natureOfWorkValues: string[]; // distinct values from contractors for this project
  contractorNatureMap: Record<string, string>; // contractor_id -> nature_of_work
};

export type HeaderBands = {
  depts: DlrDept[]; // ordered department bands
  catCols: { id: string; name: string; deptName: string }[]; // ordered category leaf columns
  catStart: number; // first category col index (2)
  catWidth: number;
  natureValues: string[]; // ordered Total Labour sub-columns
  totalLabourStart: number;
  totalLabourWidth: number;
  totalCol: number;
  pctTotalCol: number | null; // only if NMR present in natureValues
  remarksCol: number;
  numCols: number;
  hasNmr: boolean;
  nmrIndex: number; // index within natureValues that is NMR, -1 if none
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

function buildBands(departments: DlrDept[], natureOfWorkValues: string[]): HeaderBands {
  const depts = departments.filter((d) => d.categories.length > 0);
  const catCols: HeaderBands["catCols"] = [];
  for (const d of depts) for (const c of d.categories) catCols.push({ id: c.id, name: c.name, deptName: d.name });
  const catStart = 2;
  const catWidth = catCols.length;
  const natureValues = [...natureOfWorkValues].sort((a, b) => a.localeCompare(b));
  const nmrIndex = natureValues.findIndex((v) => /^nmr$/i.test(v.trim()));
  const hasNmr = nmrIndex >= 0;
  const totalLabourStart = catStart + catWidth;
  const totalLabourWidth = Math.max(natureValues.length, 1);
  const totalCol = totalLabourStart + totalLabourWidth;
  const pctTotalCol = hasNmr ? totalCol + 1 : null;
  const remarksCol = (pctTotalCol ?? totalCol) + 1;
  const numCols = remarksCol + 1;
  return { depts, catCols, catStart, catWidth, natureValues, totalLabourStart, totalLabourWidth, totalCol, pctTotalCol, remarksCol, numCols, hasNmr, nmrIndex };
}

export function getDlrDailyMatrix({ project, date, rows, departments, natureOfWorkValues, contractorNatureMap }: DlrInput): DlrMatrix {
  const dateLabel = format(date, "dd-MM-yyyy");
  const title = `${project.name}${project.code ? ` [${project.code}]` : ""}\nDAILY LABOUR REPORT — ${dateLabel}`;
  const bands = buildBands(departments, natureOfWorkValues);
  const NUM = bands.numCols;
  const blank = (): (string | number | null)[] => Array(NUM).fill(null);

  // Aggregate
  const catTotals: Record<string, number> = {};
  const natureTotals: Record<string, number> = {};
  for (const v of bands.natureValues) natureTotals[v] = 0;
  const remarksSet = new Set<string>();
  for (const r of rows) {
    const hc = Number(r.headcount || 0);
    if (r.category_id) catTotals[r.category_id] = (catTotals[r.category_id] || 0) + hc;
    const nature = (contractorNatureMap[r.contractor_id] || r.contractors?.nature_of_work || "").toString().trim();
    if (nature && nature in natureTotals) natureTotals[nature] += hc;
    if (r.remarks && String(r.remarks).trim()) remarksSet.add(String(r.remarks).trim());
  }
  const total = bands.natureValues.reduce((s, v) => s + (natureTotals[v] || 0), 0);
  const nmrTotal = bands.hasNmr ? natureTotals[bands.natureValues[bands.nmrIndex]] || 0 : 0;
  const pctOnTotal = bands.hasNmr && total > 0 ? nmrTotal / total : null;

  // r0 title
  const r0 = blank(); r0[0] = title;

  // r1: Sl.No | Name | dept names | Total Labour | Total | [NMR % on Total] | Remarks
  const r1 = blank();
  r1[0] = "Sl.No.";
  r1[1] = "Name of the Project";
  let cur = bands.catStart;
  for (const d of bands.depts) { r1[cur] = d.name; cur += d.categories.length; }
  r1[bands.totalLabourStart] = "Total Labour";
  r1[bands.totalCol] = "Total";
  if (bands.pctTotalCol !== null) r1[bands.pctTotalCol] = "NMR % on Total";
  r1[bands.remarksCol] = "Remarks";

  // r2: category leaves | nature_of_work leaves
  const r2 = blank();
  bands.catCols.forEach((c, i) => { r2[bands.catStart + i] = c.name; });
  if (bands.natureValues.length === 0) {
    r2[bands.totalLabourStart] = "Total";
  } else {
    bands.natureValues.forEach((v, i) => { r2[bands.totalLabourStart + i] = v; });
  }

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
  if (bands.natureValues.length === 0) {
    d[bands.totalLabourStart] = total;
  } else {
    bands.natureValues.forEach((v, i) => { d[bands.totalLabourStart + i] = natureTotals[v] || 0; });
  }
  d[bands.totalCol] = total;
  if (bands.pctTotalCol !== null) d[bands.pctTotalCol] = pctOnTotal;
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
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },       // Sl.No
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },       // Name
    { s: { r: 1, c: b.totalCol }, e: { r: 2, c: b.totalCol } },
    { s: { r: 1, c: b.remarksCol }, e: { r: 2, c: b.remarksCol } },
  ];
  if (b.pctTotalCol !== null) merges.push({ s: { r: 1, c: b.pctTotalCol }, e: { r: 2, c: b.pctTotalCol } });
  // Total Labour band over nature_of_work leaves
  if (b.totalLabourWidth > 1) {
    merges.push({ s: { r: 1, c: b.totalLabourStart }, e: { r: 1, c: b.totalLabourStart + b.totalLabourWidth - 1 } });
  } else {
    merges.push({ s: { r: 1, c: b.totalLabourStart }, e: { r: 2, c: b.totalLabourStart } });
  }
  // dept names in row 1 spanning their category leaves
  let cursor = b.catStart;
  for (const d of b.depts) {
    if (d.categories.length > 1) merges.push({ s: { r: 1, c: cursor }, e: { r: 1, c: cursor + d.categories.length - 1 } });
    cursor += d.categories.length;
  }
  for (const sr of matrix.sectionRows) merges.push({ s: { r: sr, c: 1 }, e: { r: sr, c: NUM - 1 } });
  ws["!merges"] = merges;

  const cols: XLSX.ColInfo[] = [{ wch: 6 }, { wch: 28 }];
  for (let i = 0; i < b.catWidth; i++) cols.push({ wch: 12 });
  for (let i = 0; i < b.totalLabourWidth; i++) cols.push({ wch: 14 });
  cols.push({ wch: 10 }); // Total
  if (b.pctTotalCol !== null) cols.push({ wch: 14 });
  cols.push({ wch: 28 }); // Remarks
  ws["!cols"] = cols;
  ws["!rows"] = [{ hpt: 36 }, { hpt: 28 }, { hpt: 28 }];

  const intFmt = '#,##0;(#,##0);"-"';
  const pctFmt = "0%";
  for (let r = matrix.headerRows; r < matrix.cells.length; r++) {
    if (matrix.sectionRows.includes(r)) continue;
    for (let c = 2; c < NUM; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (b.pctTotalCol !== null && c === b.pctTotalCol) { cell.t = "n"; cell.z = pctFmt; }
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
          if (isData && b.pctTotalCol !== null && ci === b.pctTotalCol) {
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
