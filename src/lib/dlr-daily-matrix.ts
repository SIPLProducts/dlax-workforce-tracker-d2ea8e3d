// Matrix-format Daily Labour Report workbook mirroring the reference "DD.MM.YYYY" template.
// Note: reference has NMR %, Budget NMR, NMR%/Budget columns — app has no budget data,
// so we omit those columns. Security is emitted but always 0 (no field in the app).
import XLSX from "xlsx-js-style";
import { format } from "date-fns";
import type { DlrMatrix } from "@/lib/dlr-daily";

const BORDER = { style: "thin", color: { rgb: "000000" } } as const;
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const FONT = { name: "Calibri", sz: 10 };
const FONT_B = { ...FONT, bold: true };
const FONT_TITLE = { name: "Calibri", sz: 14, bold: true };
const FILL_HEADER = { patternType: "solid", fgColor: { rgb: "FFD9D9D9" } };
const FILL_TOTALS = { patternType: "solid", fgColor: { rgb: "FFFCE4D6" } };
const FILL_GROUP = { patternType: "solid", fgColor: { rgb: "FFFFF2CC" } };
const NUM_INT = '#,##0;(#,##0);"-"';

type Cell = { v?: any; f?: string; t?: string; s?: any };
const txt = (v: string, s: any = {}): Cell => ({ v, t: "s", s: { font: FONT, alignment: { vertical: "center", wrapText: true }, border: ALL_BORDERS, ...s } });
const num = (v: number, s: any = {}): Cell => ({ v, t: "n", s: { font: FONT, alignment: { horizontal: "right", vertical: "center" }, border: ALL_BORDERS, numFmt: NUM_INT, ...s } });
const fml = (f: string, s: any = {}): Cell => ({ f, t: "n", s: { font: FONT, alignment: { horizontal: "right", vertical: "center" }, border: ALL_BORDERS, numFmt: NUM_INT, ...s } });

const H = { font: FONT_B, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: FILL_HEADER, border: ALL_BORDERS };

export type DlrMatrixWorkbookItem = { matrix: DlrMatrix; projectGroup?: string | null };

function buildSingleDlrMatrixSheet(matrix: DlrMatrix, projectGroup?: string | null): any {
  const b = matrix.bands;
  // Columns layout (0-based):
  // 0: Sl.No | 1: Project | 2..(2+catWidth-1): category leaves | catWidth cols
  // then Sub-contractor total + NMR total leaves (deptTotal band)
  // then Total | Security | Remarks
  const catStart = 2;
  const catEnd = catStart + b.catWidth - 1;
  const totalBandStart = catEnd + 1;
  // Determine dept-total leaves: separate NMR vs non-NMR from bands
  const subLeaf = totalBandStart;       // "Sub Contractors/Job Work"
  const nmrLeaf = totalBandStart + 1;   // "NMR"
  const totalCol = nmrLeaf + 1;
  const securityCol = totalCol + 1;
  const remarksCol = securityCol + 1;
  const NUM = remarksCol + 1;

  const ws: any = {};
  const merges: XLSX.Range[] = [];
  const set = (r: number, c: number, cell: Cell) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; };
  const blank = (r: number, c: number, s: any = {}) => set(r, c, txt("", s));

  // Row 0: title (merged across all columns)
  set(0, 0, txt(`DAILY LABOUR REPORT\n${matrix.dateLabel}`, { font: FONT_TITLE, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: FILL_HEADER }));
  for (let c = 1; c < NUM; c++) blank(0, c, { font: FONT_TITLE, fill: FILL_HEADER });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: NUM - 1 } });

  // Rows 1-4: 4-row header band
  for (let r = 1; r <= 4; r++) for (let c = 0; c < NUM; c++) blank(r, c, H);

  // Sl.No (A2:A5) — rows 1..4
  set(1, 0, txt("Sl.No.", H));
  merges.push({ s: { r: 1, c: 0 }, e: { r: 4, c: 0 } });
  // Name of the Project (B2:B5)
  set(1, 1, txt("Name of the Project", H));
  merges.push({ s: { r: 1, c: 1 }, e: { r: 4, c: 1 } });

  // Row 1 (index 1): department band labels merged across their category leaves
  let cur = catStart;
  for (const d of b.depts) {
    set(1, cur, txt(d.name, H));
    if (d.categories.length > 1) merges.push({ s: { r: 1, c: cur }, e: { r: 1, c: cur + d.categories.length - 1 } });
    cur += d.categories.length;
  }
  // Row 1: "Total Labour" band merged across sub+nmr leaves (M2:N3-like)
  set(1, subLeaf, txt("Total Labour", H));
  merges.push({ s: { r: 1, c: subLeaf }, e: { r: 2, c: nmrLeaf } });
  // Total / Security / Remarks — merged rows 1..4
  set(1, totalCol, txt("Total", H));
  merges.push({ s: { r: 1, c: totalCol }, e: { r: 4, c: totalCol } });
  set(1, securityCol, txt("Security", H));
  merges.push({ s: { r: 1, c: securityCol }, e: { r: 4, c: securityCol } });
  set(1, remarksCol, txt("Remarks", H));
  merges.push({ s: { r: 1, c: remarksCol }, e: { r: 4, c: remarksCol } });

  // Row 3: category leaf names + dept-total leaves ("Sub Contractors/ Job Work" | "NMR")
  b.catCols.forEach((c, i) => { set(3, catStart + i, txt(c.name, H)); });
  set(3, subLeaf, txt("Sub Contractors/ Job Work", H));
  set(3, nmrLeaf, txt("NMR", H));

  // Row 4 kept blank (reference has a sub-descriptor line the app has no data for)

  // Data rows starting at row 5 (index 5). Walk every row of the matrix so all
  // projects (and their project-group bands) land on this single sheet.
  let r = 5;
  if (projectGroup) {
    set(r, 0, txt("", { fill: FILL_GROUP, font: FONT_B }));
    set(r, 1, txt(projectGroup, { fill: FILL_GROUP, font: FONT_B, alignment: { horizontal: "left", vertical: "center" } }));
    for (let c = 2; c < NUM; c++) blank(r, c, { fill: FILL_GROUP });
    merges.push({ s: { r, c: 1 }, e: { r, c: NUM - 1 } });
    r++;
  }

  const colTotals: number[] = Array(NUM).fill(0);
  const dataRowIdxs: number[] = [];
  let sno = 1;

  for (let mr = matrix.headerRows; mr < matrix.cells.length; mr++) {
    const row = matrix.cells[mr] || [];
    if (matrix.sectionRows.includes(mr)) {
      set(r, 0, txt("", { fill: FILL_GROUP, font: FONT_B }));
      set(r, 1, txt(String(row[1] ?? ""), { fill: FILL_GROUP, font: FONT_B, alignment: { horizontal: "left", vertical: "center" } }));
      for (let c = 2; c < NUM; c++) blank(r, c, { fill: FILL_GROUP });
      merges.push({ s: { r, c: 1 }, e: { r, c: NUM - 1 } });
      r++;
      continue;
    }

    set(r, 0, num(sno++, { alignment: { horizontal: "center", vertical: "center" }, numFmt: "0" }));
    set(r, 1, txt(String(row[1] ?? ""), { alignment: { horizontal: "left", vertical: "center", wrapText: true } }));

    let subTotal = 0;
    let nmrTotal = 0;
    b.catCols.forEach((cc, i) => {
      const v = Number(row[b.catStart + i] || 0);
      set(r, catStart + i, num(v));
      colTotals[catStart + i] += v;
      if (cc.isNmr) nmrTotal += v; else subTotal += v;
    });

    set(r, subLeaf, num(subTotal, { fill: FILL_TOTALS, font: FONT_B }));
    set(r, nmrLeaf, num(nmrTotal, { fill: FILL_TOTALS, font: FONT_B }));
    set(r, totalCol, num(subTotal + nmrTotal, { fill: FILL_TOTALS, font: FONT_B }));
    set(r, securityCol, num(0));
    set(r, remarksCol, txt(String(row[b.remarksCol] ?? ""), { alignment: { horizontal: "left", vertical: "center", wrapText: true } }));

    colTotals[subLeaf] += subTotal;
    colTotals[nmrLeaf] += nmrTotal;
    colTotals[totalCol] += subTotal + nmrTotal;
    dataRowIdxs.push(r);
    r++;
  }

  // Grand total row
  if (dataRowIdxs.length > 0) {
    set(r, 0, txt("", { fill: FILL_TOTALS, font: FONT_B }));
    set(r, 1, txt("Total", { fill: FILL_TOTALS, font: FONT_B, alignment: { horizontal: "left", vertical: "center" } }));
    for (let c = catStart; c <= totalCol; c++) set(r, c, num(colTotals[c], { fill: FILL_TOTALS, font: FONT_B }));
    set(r, securityCol, num(0, { fill: FILL_TOTALS, font: FONT_B }));
    set(r, remarksCol, txt("", { fill: FILL_TOTALS, font: FONT_B }));
    r++;
  }


  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: NUM - 1 } });
  ws["!merges"] = merges;

  // Column widths per reference
  const cols: XLSX.ColInfo[] = [{ wch: 8 }, { wch: 32 }];
  for (let i = 0; i < b.catWidth; i++) cols.push({ wch: 13 });
  cols.push({ wch: 16 }); // sub
  cols.push({ wch: 10 }); // nmr
  cols.push({ wch: 11 }); // total
  cols.push({ wch: 12 }); // security
  cols.push({ wch: 30 }); // remarks
  ws["!cols"] = cols;

  ws["!rows"] = [{ hpt: 42 }, { hpt: 18 }, { hpt: 18 }, { hpt: 24 }, { hpt: 24 }];
  (ws as any)["!views"] = [{ state: "frozen", xSplit: 2, ySplit: 5 }];
  (ws as any)["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 };
  (ws as any)["!margins"] = { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 };

  return ws;
}

export function buildDlrMatrixWorkbook(items: DlrMatrixWorkbookItem[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const seenNames = new Set<string>();
  for (const item of items) {
    const ws = buildSingleDlrMatrixSheet(item.matrix, item.projectGroup);
    let sheetName = item.matrix.dateLabel.replace(/-/g, ".");
    let uniqueName = sheetName;
    let n = 1;
    while (seenNames.has(uniqueName)) {
      uniqueName = `${sheetName}-${n++}`;
    }
    seenNames.add(uniqueName);
    XLSX.utils.book_append_sheet(wb, ws, uniqueName);
  }
  return wb;
}

export function downloadDlrMatrixXlsx(items: DlrMatrixWorkbookItem[], filename: string) {
  const wb = buildDlrMatrixWorkbook(items);
  XLSX.writeFile(wb, filename);
}
