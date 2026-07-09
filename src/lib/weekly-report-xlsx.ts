import XLSX from "xlsx-js-style";
import { format } from "date-fns";
import type { WeeklyMatrix } from "./weekly-report";
import { weeklyDateRangeLabel } from "./weekly-report";

const BORDER = { style: "thin", color: { rgb: "000000" } } as const;
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const FONT = { name: "Calibri", sz: 10 };
const FONT_B = { ...FONT, bold: true };
const FILL_HEAD = { patternType: "solid", fgColor: { rgb: "FFDCDCDC" } };
const FILL_TOT = { patternType: "solid", fgColor: { rgb: "FFF0F0F0" } };

type Cell = { v: any; t?: string; s?: any };
const txt = (v: string, s: any = {}): Cell => ({
  v, t: "s", s: { font: FONT, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: ALL_BORDERS, ...s },
});
const num = (v: number, s: any = {}): Cell => ({
  v, t: "n", s: { font: FONT, alignment: { horizontal: "right", vertical: "center" }, border: ALL_BORDERS, numFmt: '#,##0;(#,##0);""', ...s },
});
const blank = (s: any = {}): Cell => txt("", s);

export function downloadWeeklyReportXlsx(m: WeeklyMatrix, filename: string) {
  const wb = XLSX.utils.book_new();
  const ws: any = {};
  const merges: XLSX.Range[] = [];
  const set = (r: number, c: number, cell: Cell) => {
    ws[XLSX.utils.encode_cell({ r, c })] = cell;
  };

  const totalCols = 3 + 14 + 4; // sno, code, name, 7*(ir,nmr), totIR, totNMR, totWeek, perWeek
  const lastCol = totalCols - 1;

  // Banner row 0
  const projLabel = m.project.code ? `[${m.project.code}] ${m.project.name}` : m.project.name;
  set(0, 0, txt(`Name of the Project: ${projLabel}`, { alignment: { horizontal: "left", vertical: "center" }, font: FONT_B }));
  for (let c = 1; c < 8; c++) set(0, c, blank({ alignment: { horizontal: "left" } }));
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
  set(0, 8, txt("KPC PROJECTS LTD", { font: { ...FONT_B, sz: 13 } }));
  for (let c = 9; c < lastCol - 1; c++) set(0, c, blank());
  merges.push({ s: { r: 0, c: 8 }, e: { r: 0, c: lastCol - 2 } });
  set(0, lastCol - 1, txt("KPC", { font: { ...FONT_B, sz: 14 } }));
  set(0, lastCol, blank());
  merges.push({ s: { r: 0, c: lastCol - 1 }, e: { r: 0, c: lastCol } });

  // Banner row 1
  set(1, 0, txt(`Date: ${weeklyDateRangeLabel(m)}`, { alignment: { horizontal: "left", vertical: "center" } }));
  for (let c = 1; c < 8; c++) set(1, c, blank({ alignment: { horizontal: "left" } }));
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } });
  set(1, 8, txt("WEEKLY LABOUR REPORT", { font: { ...FONT_B, sz: 11 } }));
  for (let c = 9; c < lastCol - 1; c++) set(1, c, blank());
  merges.push({ s: { r: 1, c: 8 }, e: { r: 1, c: lastCol - 2 } });
  set(1, lastCol - 1, blank());
  set(1, lastCol, blank());
  merges.push({ s: { r: 1, c: lastCol - 1 }, e: { r: 1, c: lastCol } });

  // Header row 2 & 3
  const H = { font: FONT_B, fill: FILL_HEAD };
  set(2, 0, txt("S.No", H)); set(3, 0, blank(H)); merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
  set(2, 1, txt("SC Code", H)); set(3, 1, blank(H)); merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } });
  set(2, 2, txt("Name of the Contractor", H)); set(3, 2, blank(H)); merges.push({ s: { r: 2, c: 2 }, e: { r: 3, c: 2 } });

  m.days.forEach((d, i) => {
    const c = 3 + i * 2;
    set(2, c, txt(format(d, "EEE dd.MM"), H));
    set(2, c + 1, blank(H));
    merges.push({ s: { r: 2, c }, e: { r: 2, c: c + 1 } });
    set(3, c, txt("IR", H));
    set(3, c + 1, txt("NMR", H));
  });

  const tCol = 3 + 14;
  ["Total IR", "Total NMR", "Total Week Labour", "Per Week (Total/7)"].forEach((label, i) => {
    set(2, tCol + i, txt(label, H));
    set(3, tCol + i, blank(H));
    merges.push({ s: { r: 2, c: tCol + i }, e: { r: 3, c: tCol + i } });
  });

  // Body
  let r = 4;
  m.rows.forEach((row, idx) => {
    set(r, 0, num(idx + 1, { alignment: { horizontal: "center", vertical: "center" }, numFmt: "0" }));
    set(r, 1, txt(row.code, { alignment: { horizontal: "center", vertical: "center" } }));
    set(r, 2, txt(row.name, { alignment: { horizontal: "left", vertical: "center", wrapText: true } }));
    row.days.forEach((d, i) => {
      set(r, 3 + i * 2, num(d.ir));
      set(r, 3 + i * 2 + 1, num(d.nmr));
    });
    set(r, tCol, num(row.totalIR, { font: FONT_B }));
    set(r, tCol + 1, num(row.totalNMR, { font: FONT_B }));
    set(r, tCol + 2, num(row.totalWeek, { font: FONT_B }));
    set(r, tCol + 3, num(row.perWeek, { font: FONT_B, numFmt: '0.00;(0.00);""' }));
    r++;
  });

  // Totals row
  set(r, 0, txt("Totals", { font: FONT_B, fill: FILL_TOT, alignment: { horizontal: "right", vertical: "center" } }));
  set(r, 1, blank({ font: FONT_B, fill: FILL_TOT }));
  set(r, 2, blank({ font: FONT_B, fill: FILL_TOT }));
  merges.push({ s: { r, c: 0 }, e: { r, c: 2 } });
  m.totals.days.forEach((d, i) => {
    set(r, 3 + i * 2, num(d.ir, { font: FONT_B, fill: FILL_TOT }));
    set(r, 3 + i * 2 + 1, num(d.nmr, { font: FONT_B, fill: FILL_TOT }));
  });
  set(r, tCol, num(m.totals.totalIR, { font: FONT_B, fill: FILL_TOT }));
  set(r, tCol + 1, num(m.totals.totalNMR, { font: FONT_B, fill: FILL_TOT }));
  set(r, tCol + 2, num(m.totals.totalWeek, { font: FONT_B, fill: FILL_TOT }));
  set(r, tCol + 3, num(m.totals.perWeek, { font: FONT_B, fill: FILL_TOT, numFmt: '0.00;(0.00);""' }));
  r++;

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: lastCol } });
  ws["!merges"] = merges;
  const cols: XLSX.ColInfo[] = [{ wch: 5 }, { wch: 10 }, { wch: 28 }];
  for (let i = 0; i < 14; i++) cols.push({ wch: 6 });
  cols.push({ wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 });
  ws["!cols"] = cols;
  ws["!rows"] = [{ hpt: 20 }, { hpt: 20 }, { hpt: 22 }, { hpt: 20 }];
  (ws as any)["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 };

  XLSX.utils.book_append_sheet(wb, ws, "Weekly");
  XLSX.writeFile(wb, filename);
}
