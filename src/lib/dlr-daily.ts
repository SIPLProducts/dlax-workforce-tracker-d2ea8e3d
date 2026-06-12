import * as XLSX from "xlsx";
import { format } from "date-fns";

// Reference column order (after Sl.No + Project Name)
export const DLR_CATEGORY_COLUMNS = [
  "Masons",
  "Carpenters",
  "Steel Fixers",
  "Painters",
  "Helpers",
  "Skilled",
  "Helpers (MEP)",
  "Mason",
  "Helpers (M)",
  "Helpers (F)",
] as const;

// Aliases (case/space-insensitive) for matching worker_categories.name → column
const ALIASES: Record<(typeof DLR_CATEGORY_COLUMNS)[number], string[]> = {
  Masons: ["masons", "mason civil", "civil mason", "civil masons"],
  Carpenters: ["carpenters", "carpenter"],
  "Steel Fixers": ["steel fixers", "steel fixer", "barbender", "bar bender", "rod bender", "fabricator"],
  Painters: ["painters", "painter"],
  Helpers: ["helpers", "helper", "civil helpers", "helpers civil", "helpers (civil)"],
  Skilled: ["skilled", "mep skilled", "skilled mep", "skilled (mep)"],
  "Helpers (MEP)": ["mep helpers", "helpers mep", "helpers (mep)"],
  Mason: ["nmr mason", "mason nmr", "mason (nmr)"],
  "Helpers (M)": ["helpers (m)", "helpers m", "male helpers", "helpers male"],
  "Helpers (F)": ["helpers (f)", "helpers f", "female helpers", "helpers female"],
};

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function matchColumn(catName: string): (typeof DLR_CATEGORY_COLUMNS)[number] | null {
  const n = norm(catName);
  if (!n) return null;
  for (const col of DLR_CATEGORY_COLUMNS) {
    if (ALIASES[col].some((a) => norm(a) === n)) return col;
  }
  return null;
}

export type DlrInput = {
  project: { id: string; code?: string | null; name: string; project_group?: string | null };
  date: Date;
  rows: any[]; // daily_manpower rows with joined projects/contractors/worker_categories
};

export type DlrMatrix = {
  title: string;
  dateLabel: string;
  // 2D array of cell values used by preview + CSV. Headers occupy rows 0..4
  cells: (string | number | null)[][];
  // Section header row indexes (full-span) — these are the project_group rows
  sectionRows: number[];
  // Index of the project data row
  dataRow: number;
};

const NUM_COLS = 20;
const HEADER_ROWS = 5;

export function getDlrDailyMatrix({ project, date, rows }: DlrInput): DlrMatrix {
  const dateLabel = format(date, "dd-MM-yyyy");
  const title = `DAILY LABOUR REPORT\n${dateLabel}`;

  // Aggregate by category column + nature_of_work
  const catTotals: Record<string, number> = {};
  let itemRateTotal = 0;
  let nmrTotal = 0;
  const remarksSet = new Set<string>();

  for (const r of rows) {
    const hc = Number(r.headcount || 0);
    const nature = (r.contractors?.nature_of_work || "").toString().trim().toLowerCase();
    if (nature === "nmr") nmrTotal += hc;
    else itemRateTotal += hc; // default Item Rate / sub contractor
    const col = matchColumn(r.worker_categories?.name || "");
    if (col) catTotals[col] = (catTotals[col] || 0) + hc;
    if (r.remarks && String(r.remarks).trim()) remarksSet.add(String(r.remarks).trim());
  }
  const total = itemRateTotal + nmrTotal;
  const pctOnTotal = total > 0 ? nmrTotal / total : null;

  // Build header rows (5 rows × 20 cols)
  const blank = (): (string | number | null)[] => Array(NUM_COLS).fill(null);
  const r1 = blank(); r1[0] = title;
  const r2 = blank();
  r2[0] = "Sl.No.";
  r2[1] = "Name of the Project";
  r2[2] = "Sub Contractors/Job Works"; // merged C..I (cols 2..8)
  r2[9] = "NMR";                        // merged J..L (cols 9..11)
  r2[12] = "Total Labour";              // merged M..N (cols 12..13)
  r2[14] = "Total";
  r2[15] = "NMR             % on Total";
  r2[16] = "Budget NMR";
  r2[17] = "NMR             % on Budget";
  r2[18] = "Security";
  r2[19] = "Remarks";

  const r3 = blank();
  r3[2] = "Civil"; // merged C..G (2..6)
  r3[7] = "MEP";   // merged H..I (7..8)

  const r4 = blank();
  ["Masons","Carpenters","Steel Fixers","Painters","Helpers","Skilled","Helpers","Mason","Helpers (M)","Helpers (F)","Sub Contractors/ Job Work","NMR"]
    .forEach((v, i) => { r4[2 + i] = v; });

  const r5 = blank();
  r5[2] = "Tiles, Granite, Brickwork, Glazing";
  r5[3] = "Shuttering, Scaffolding, Wood works";
  r5[4] = "Fabricator works, Rod benders";

  const cells: (string | number | null)[][] = [r1, r2, r3, r4, r5];
  const sectionRows: number[] = [];

  // Section header row (project group) — span first 2 columns at least
  if (project.project_group) {
    const sec = blank();
    sec[0] = "";
    sec[1] = project.project_group;
    sectionRows.push(cells.length);
    cells.push(sec);
  }

  // Project data row
  const dataRow = cells.length;
  const dRow = blank();
  dRow[0] = 1;
  dRow[1] = project.code || project.name;
  DLR_CATEGORY_COLUMNS.forEach((col, i) => {
    dRow[2 + i] = catTotals[col] || 0;
  });
  dRow[12] = itemRateTotal;
  dRow[13] = nmrTotal;
  dRow[14] = total;
  dRow[15] = pctOnTotal; // 0..1 fraction; preview/csv format as %
  dRow[16] = 0;          // Budget NMR placeholder
  dRow[17] = null;       // % on Budget — blank (div by 0)
  dRow[18] = 0;          // Security placeholder
  dRow[19] = remarksSet.size ? Array.from(remarksSet).join("; ") : "";
  cells.push(dRow);

  return { title, dateLabel, cells, sectionRows, dataRow };
}

// Helpers
const colLetter = (i: number) => XLSX.utils.encode_col(i);

export function buildDlrDailyWorkbook(matrix: DlrMatrix): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(matrix.cells);

  // Merges
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: NUM_COLS - 1 } }, // Title row
    // Row 2 vertical spans (rows 1..3 / cols A,B and right-side columns)
    { s: { r: 1, c: 0 }, e: { r: 3, c: 0 } }, // Sl.No
    { s: { r: 1, c: 1 }, e: { r: 3, c: 1 } }, // Name
    { s: { r: 1, c: 2 }, e: { r: 1, c: 8 } }, // Sub Contractors/Job Works (C2:I2)
    { s: { r: 1, c: 9 }, e: { r: 1, c: 11 } }, // NMR (J2:L2)
    { s: { r: 1, c: 12 }, e: { r: 1, c: 13 } }, // Total Labour (M2:N2)
    { s: { r: 1, c: 14 }, e: { r: 3, c: 14 } }, // Total
    { s: { r: 1, c: 15 }, e: { r: 3, c: 15 } }, // NMR % on Total
    { s: { r: 1, c: 16 }, e: { r: 3, c: 16 } }, // Budget NMR
    { s: { r: 1, c: 17 }, e: { r: 3, c: 17 } }, // NMR % on Budget
    { s: { r: 1, c: 18 }, e: { r: 3, c: 18 } }, // Security
    { s: { r: 1, c: 19 }, e: { r: 3, c: 19 } }, // Remarks
    { s: { r: 2, c: 2 }, e: { r: 2, c: 6 } }, // Civil (C3:G3)
    { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } }, // MEP (H3:I3)
    { s: { r: 2, c: 9 }, e: { r: 3, c: 11 } }, // NMR sub-cols (vertical merge into J3:L4 since row 4 hosts headers)
    { s: { r: 2, c: 12 }, e: { r: 2, c: 13 } }, // Total Labour second row span
  ];
  // Section rows: span across all columns A..T
  for (const sr of matrix.sectionRows) {
    merges.push({ s: { r: sr, c: 1 }, e: { r: sr, c: NUM_COLS - 1 } });
  }
  ws["!merges"] = merges;

  // Column widths
  ws["!cols"] = [
    { wch: 6 },  { wch: 28 },
    ...Array(10).fill({ wch: 12 }),
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 28 },
  ].slice(0, NUM_COLS);

  // Row heights
  ws["!rows"] = [
    { hpt: 36 }, { hpt: 22 }, { hpt: 18 }, { hpt: 36 }, { hpt: 28 },
  ];

  // Number formats — apply per cell after sheet built
  const intFmt = '#,##0;(#,##0);"-"';
  const pctFmt = "0%";
  for (let r = HEADER_ROWS; r < matrix.cells.length; r++) {
    if (matrix.sectionRows.includes(r)) continue;
    for (let c = 2; c < NUM_COLS; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      if (c === 15 || c === 17) {
        cell.t = "n";
        cell.z = pctFmt;
      } else if (c === 19) {
        // Remarks stay text
      } else if (typeof cell.v === "number") {
        cell.t = "n";
        cell.z = intFmt;
      }
    }
  }

  // Freeze top header rows + first 2 columns
  ws["!freeze"] = { xSplit: 2, ySplit: HEADER_ROWS } as any;
  (ws as any)["!views"] = [{ state: "frozen", xSplit: 2, ySplit: HEADER_ROWS }];

  XLSX.utils.book_append_sheet(wb, ws, matrix.dateLabel.replace(/-/g, "."));
  return wb;
}

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildDlrDailyCsv(matrix: DlrMatrix): string {
  return matrix.cells
    .map((row, ri) =>
      row
        .map((v, ci) => {
          if (v === null || v === undefined) return "";
          // Percent columns
          if (ri >= HEADER_ROWS && !matrix.sectionRows.includes(ri) && (ci === 15 || ci === 17)) {
            if (typeof v === "number") return csvEscape(`${Math.round(v * 100)}%`);
            return "";
          }
          // Zero → "-" for numeric data rows in cat/total cols
          if (ri >= HEADER_ROWS && !matrix.sectionRows.includes(ri) && ci >= 2 && ci <= 18 && typeof v === "number" && v === 0) {
            return csvEscape("-");
          }
          return csvEscape(v);
        })
        .join(",")
    )
    .join("\n");
}

export function downloadDlrXlsx(matrix: DlrMatrix, filename: string) {
  const wb = buildDlrDailyWorkbook(matrix);
  XLSX.writeFile(wb, filename);
}

export function downloadDlrCsv(matrix: DlrMatrix, filename: string) {
  const csv = buildDlrDailyCsv(matrix);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
