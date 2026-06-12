import { DlrMatrix } from "@/lib/dlr-daily";

export function DlrDailyPreview({ matrix }: { matrix: DlrMatrix }) {
  const HEADER_ROWS = 5;
  const NUM_COLS = 20;

  const fmtNum = (v: any) => {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return v === 0 ? "-" : v.toLocaleString();
    return String(v);
  };
  const fmtPct = (v: any) => {
    if (typeof v !== "number") return "";
    return `${Math.round(v * 100)}%`;
  };

  // Render header (rows 0..4) with merges, then body
  return (
    <div className="overflow-auto border rounded-md">
      <table className="border-collapse text-xs w-full">
        <thead>
          {/* Row 0: Title */}
          <tr>
            <th colSpan={NUM_COLS} className="border bg-muted text-center font-bold py-2 whitespace-pre-line">
              {matrix.cells[0][0]}
            </th>
          </tr>
          {/* Row 1 + Row 2 combined header band */}
          <tr>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">Sl.No.</th>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">Name of the Project</th>
            <th colSpan={7} className="border bg-muted px-2 py-1">Sub Contractors/Job Works</th>
            <th colSpan={3} className="border bg-muted px-2 py-1">NMR</th>
            <th colSpan={2} className="border bg-muted px-2 py-1">Total Labour</th>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">Total</th>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">NMR % on Total</th>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">Budget NMR</th>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">NMR % on Budget</th>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">Security</th>
            <th rowSpan={3} className="border bg-muted px-2 py-1 align-middle">Remarks</th>
          </tr>
          <tr>
            <th colSpan={5} className="border bg-muted px-2 py-1">Civil</th>
            <th colSpan={2} className="border bg-muted px-2 py-1">MEP</th>
            <th colSpan={3} rowSpan={2} className="border bg-muted px-2 py-1 align-middle">
              <div>Mason</div>
              <div>Helpers (M)</div>
              <div>Helpers (F)</div>
            </th>
            <th colSpan={2} rowSpan={2} className="border bg-muted px-2 py-1 align-middle">
              <div>Sub Contractors/Job Work · NMR</div>
            </th>
          </tr>
          <tr>
            <th className="border bg-muted px-2 py-1">Masons</th>
            <th className="border bg-muted px-2 py-1">Carpenters</th>
            <th className="border bg-muted px-2 py-1">Steel Fixers</th>
            <th className="border bg-muted px-2 py-1">Painters</th>
            <th className="border bg-muted px-2 py-1">Helpers</th>
            <th className="border bg-muted px-2 py-1">Skilled</th>
            <th className="border bg-muted px-2 py-1">Helpers</th>
          </tr>
        </thead>
        <tbody>
          {matrix.cells.slice(HEADER_ROWS).map((row, idx) => {
            const ri = idx + HEADER_ROWS;
            if (matrix.sectionRows.includes(ri)) {
              return (
                <tr key={ri}>
                  <td className="border px-2 py-1 font-semibold bg-accent/20"></td>
                  <td colSpan={NUM_COLS - 1} className="border px-2 py-1 font-semibold bg-accent/20">{row[1]}</td>
                </tr>
              );
            }
            return (
              <tr key={ri}>
                {row.map((v, ci) => {
                  const isPct = ci === 15 || ci === 17;
                  return (
                    <td key={ci} className={`border px-2 py-1 ${ci >= 2 ? "text-right tabular-nums" : ""}`}>
                      {isPct ? fmtPct(v) : fmtNum(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
