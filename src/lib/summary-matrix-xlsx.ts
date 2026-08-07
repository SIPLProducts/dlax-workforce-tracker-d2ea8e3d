// Matrix-format Summary workbook mirroring the reference "May'YY" template.
// Note: app data-model has one row per project (no Item Rate / NMR / Total sub-rows,
// no Roman/Alpha hierarchy). We emit one row per project grouped by project_group.
import XLSX from "xlsx-js-style";
import { format } from "date-fns";

export type SummaryColumnDef =
  | { kind: "day"; date: Date; key: string }
  | { kind: "avg"; week: number; key: string }
  | { kind: "month"; key: string };

export type SummaryProjectRow = {
  id: string;
  name: string;
  code: string;
  group?: string | null;
  dayVals: Record<string, number>;
  weekAvgs: Record<string, number | null>;
  monthTotal: number;
};

export type SummaryMatrixInput = {
  dateFrom: Date;
  dateTo: Date;
  columns: SummaryColumnDef[];
  projectRows: SummaryProjectRow[];
  colTotals: Record<string, number | null>;
};

const BORDER = { style: "thin", color: { rgb: "000000" } } as const;
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const FONT = { name: "Calibri", sz: 10 };
const FONT_B = { ...FONT, bold: true };
const FONT_TITLE = { name: "Calibri", sz: 14, bold: true };
const FONT_SUB = { name: "Calibri", sz: 12, bold: true };

const FILL_HEADER = { patternType: "solid", fgColor: { rgb: "FFD9D9D9" } };
const FILL_AVG = { patternType: "solid", fgColor: { rgb: "FFFCE4D6" } };
const FILL_MONTH = { patternType: "solid", fgColor: { rgb: "FFF4B084" } };
const FILL_GROUP = { patternType: "solid", fgColor: { rgb: "FFFFF2CC" } };
const FILL_TOTAL = { patternType: "solid", fgColor: { rgb: "FFFFE699" } };

const NUM_INT = '#,##0;(#,##0);"-"';
const NUM_AVG = '0.0;(0.0);"-"';

type Cell = { v: any; t?: string; s?: any; f?: string };

function txt(v: string, s: any = {}): Cell {
  return { v, t: "s", s: { font: FONT, alignment: { vertical: "center", wrapText: true }, border: ALL_BORDERS, ...s } };
}
function num(v: number, s: any = {}): Cell {
  return { v, t: "n", s: { font: FONT, alignment: { horizontal: "right", vertical: "center" }, border: ALL_BORDERS, numFmt: NUM_INT, ...s } };
}

export function buildSummaryMatrixWorkbook(input: SummaryMatrixInput): XLSX.WorkBook {
  const { dateFrom, dateTo, columns, projectRows, colTotals } = input;
  const monthLabel = format(dateFrom, "MMM''yy");
  const totalCols = 2 + columns.length + 1; // S.No + Project + cols + Remarks
  const remarksCol = totalCols - 1;

  const wb = XLSX.utils.book_new();
  const ws: any = {};
  const merges: XLSX.Range[] = [];

  const set = (r: number, c: number, cell: Cell) => {
    ws[XLSX.utils.encode_cell({ r, c })] = cell;
  };
  const blank = (r: number, c: number, s: any = {}) => set(r, c, txt("", s));

  // Row 0: title
  set(0, 0, txt("KPC Projects Limited", { font: FONT_TITLE, alignment: { horizontal: "center", vertical: "center" }, fill: FILL_HEADER }));
  for (let c = 1; c < totalCols; c++) blank(0, c, { font: FONT_TITLE, fill: FILL_HEADER });
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

  // Row 1: subtitle
  set(1, 0, txt(`Manpower engaged for the month of ${monthLabel}`, { font: FONT_SUB, alignment: { horizontal: "center", vertical: "center" }, fill: FILL_HEADER }));
  for (let c = 1; c < totalCols; c++) blank(1, c, { font: FONT_SUB, fill: FILL_HEADER });
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });

  // Rows 2-3: header band
  const H_STYLE = { font: FONT_B, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: FILL_HEADER };
  set(2, 0, txt("S.No", H_STYLE));
  set(3, 0, txt("", H_STYLE));
  merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });

  set(2, 1, txt("Project Name", H_STYLE));
  set(3, 1, txt("", H_STYLE));
  merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } });

  // "Manpower deployed at site" across all day/avg cols
  set(2, 2, txt("Manpower deployed at site", H_STYLE));
  for (let c = 3; c < 2 + columns.length; c++) blank(2, c, H_STYLE);
  merges.push({ s: { r: 2, c: 2 }, e: { r: 2, c: 2 + columns.length - 1 } });

  // Row 3: day / avg leaves
  columns.forEach((col, i) => {
    const c = 2 + i;
    if (col.kind === "day") {
      set(3, c, { v: Number(format(col.date, "d")), t: "n", s: { ...H_STYLE, border: ALL_BORDERS } });
    } else if (col.kind === "avg") {
      set(3, c, txt(`Average per Week-${col.week}`, { ...H_STYLE, fill: FILL_AVG, border: ALL_BORDERS }));
    } else {
      set(3, c, txt(`Total labour for the month of ${monthLabel}`, { ...H_STYLE, fill: FILL_MONTH, border: ALL_BORDERS }));
    }
  });

  // Month-total header col already placed above if present; ensure standalone month col handled below
  // Remarks header (merged vertical)
  set(2, remarksCol, txt("Remarks", H_STYLE));
  set(3, remarksCol, txt("", H_STYLE));
  merges.push({ s: { r: 2, c: remarksCol }, e: { r: 3, c: remarksCol } });

  // Body rows: group by project_group
  let r = 4;
  const grouped = new Map<string, SummaryProjectRow[]>();
  for (const p of projectRows) {
    const g = p.group || "";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(p);
  }
  const groups = Array.from(grouped.keys()).sort();

  let sno = 0;
  for (const g of groups) {
    if (g) {
      set(r, 0, txt("", { fill: FILL_GROUP, font: FONT_B }));
      set(r, 1, txt(g, { fill: FILL_GROUP, font: FONT_B, alignment: { horizontal: "left", vertical: "center" } }));
      for (let c = 2; c < totalCols; c++) blank(r, c, { fill: FILL_GROUP });
      merges.push({ s: { r, c: 1 }, e: { r, c: totalCols - 1 } });
      r++;
    }
    for (const p of grouped.get(g)!) {
      sno++;
      set(r, 0, num(sno, { alignment: { horizontal: "center", vertical: "center" }, numFmt: "0" }));
      set(r, 1, txt(p.name || p.code || "", { alignment: { horizontal: "left", vertical: "center", wrapText: true } }));
      columns.forEach((col, i) => {
        const c = 2 + i;
        if (col.kind === "day") {
          set(r, c, num(p.dayVals[col.key] || 0));
        } else if (col.kind === "avg") {
          const v = p.weekAvgs[col.key];
          if (v == null) set(r, c, txt("", { fill: FILL_AVG, border: ALL_BORDERS }));
          else set(r, c, num(v, { fill: FILL_AVG, numFmt: NUM_AVG }));
        } else {
          set(r, c, num(p.monthTotal, { fill: FILL_MONTH, font: FONT_B }));
        }
      });
      set(r, remarksCol, txt("", { alignment: { horizontal: "left", vertical: "center", wrapText: true } }));
      r++;
    }
  }

  // Grand Total row
  set(r, 0, txt("", { fill: FILL_TOTAL, font: FONT_B }));
  set(r, 1, txt("Grand Total", { fill: FILL_TOTAL, font: FONT_B, alignment: { horizontal: "right", vertical: "center" } }));
  columns.forEach((col, i) => {
    const c = 2 + i;
    const v = colTotals[col.key];
    if (v == null) set(r, c, txt("", { fill: FILL_TOTAL, border: ALL_BORDERS }));
    else set(r, c, num(v, { fill: FILL_TOTAL, font: FONT_B, numFmt: col.kind === "avg" ? NUM_AVG : NUM_INT }));
  });
  set(r, remarksCol, txt("", { fill: FILL_TOTAL }));
  r++;

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: totalCols - 1 } });
  ws["!merges"] = merges;

  // Column widths
  const cols: XLSX.ColInfo[] = [{ wch: 6 }, { wch: 32 }];
  for (const col of columns) {
    if (col.kind === "day") cols.push({ wch: 5 });
    else if (col.kind === "avg") cols.push({ wch: 11 });
    else cols.push({ wch: 16 });
  }
  cols.push({ wch: 28 });
  ws["!cols"] = cols;

  // Row heights
  const rows: XLSX.RowInfo[] = [{ hpt: 36 }, { hpt: 24 }, { hpt: 22 }, { hpt: 26 }];
  ws["!rows"] = rows;

  // Freeze panes
  (ws as any)["!views"] = [{ state: "frozen", xSplit: 2, ySplit: 4 }];

  // Page setup
  (ws as any)["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 };
  (ws as any)["!margins"] = { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 };

  const sheetName = format(dateFrom, "MMM''yy").replace(/[\\/*?:[\]]/g, "");
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // silence date range unused warning
  void dateTo;
  return wb;
}

export function downloadSummaryMatrixXlsx(input: SummaryMatrixInput, filename: string) {
  const wb = buildSummaryMatrixWorkbook(input);
  XLSX.writeFile(wb, filename);
}
