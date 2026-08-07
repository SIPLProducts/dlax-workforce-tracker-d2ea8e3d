import { DlrMatrix } from "@/lib/dlr-daily";

export function DlrDailyPreview({ matrix }: { matrix: DlrMatrix }) {
  const b = matrix.bands;
  const NUM = b.numCols;

  const fmtNum = (v: any) => {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return v === 0 ? "-" : v.toLocaleString();
    return String(v);
  };

  // Category-wise totals across all project rows (skip header + group band rows)
  const colTotals: number[] = Array(NUM).fill(0);
  for (let r = matrix.headerRows; r < matrix.cells.length; r++) {
    if (matrix.sectionRows.includes(r)) continue;
    const row = matrix.cells[r] || [];
    for (let c = 2; c < NUM; c++) {
      if (c === b.remarksCol) continue;
      const v = Number(row[c] || 0);
      if (!Number.isNaN(v)) colTotals[c] += v;
    }
  }
  const hasData = matrix.cells.length > matrix.headerRows;

  const cellBase = "border-b border-r border-border px-2 py-1";
  const headBase = `${cellBase} bg-muted sticky`;
  const col0 = "sticky left-0 w-16 min-w-16 max-w-16";
  const col1 = "sticky left-16 w-44 min-w-44 max-w-44";

  return (
    <div className="border rounded-md overflow-auto max-h-[70vh] relative">
      <table className="border-separate border-spacing-0 text-xs w-full">
        <thead>
          <tr>
            <th
              colSpan={NUM}
              className={`${headBase} top-0 z-30 h-10 text-center font-bold whitespace-pre-line border-l border-t`}
            >
              {matrix.cells[0][0]}
            </th>
          </tr>
          <tr>
            <th rowSpan={3} className={`${headBase} ${col0} top-10 z-40 align-middle border-l`}>Sl.No.</th>
            <th rowSpan={3} className={`${headBase} ${col1} top-10 z-40 align-middle`}>Name of the Project</th>
            {b.depts.map((d, i) => (
              <th key={i} colSpan={d.categories.length} className={`${headBase} top-10 z-20 h-8 text-center`}>{d.name}</th>
            ))}
            <th colSpan={2} className={`${headBase} top-10 z-20 text-center`}>Total Labour</th>
            <th rowSpan={3} className={`${headBase} top-10 z-20 align-middle text-center`}>Total</th>
            <th rowSpan={3} className={`${headBase} top-10 z-20 align-middle text-center`}>Security</th>
            <th rowSpan={3} className={`${headBase} top-10 z-20 align-middle`}>Remarks</th>
          </tr>
          <tr>
            {b.catCols.map((_c, i) => (
              <th key={`p-${i}`} className={`${headBase} top-[72px] z-20 h-6`} />
            ))}
            <th className={`${headBase} top-[72px] z-20`} />
            <th className={`${headBase} top-[72px] z-20`} />
          </tr>
          <tr>
            {b.catCols.map((c) => (
              <th key={c.id} className={`${headBase} top-[96px] z-20 text-center min-w-24`}>{c.name}</th>
            ))}
            <th className={`${headBase} top-[96px] z-20 text-center min-w-28`}>Sub Contractors/ Job Work</th>
            <th className={`${headBase} top-[96px] z-20 text-center min-w-20`}>NMR</th>
          </tr>
        </thead>
        <tbody>
          {matrix.cells.slice(matrix.headerRows).map((row, idx) => {
            const ri = idx + matrix.headerRows;
            if (matrix.sectionRows.includes(ri)) {
              return (
                <tr key={ri}>
                  <td className={`${cellBase} ${col0} z-10 font-semibold bg-accent/20 border-l`}></td>
                  <td colSpan={NUM - 1} className={`${cellBase} font-semibold bg-accent/20`}>{row[1]}</td>
                </tr>
              );
            }
            return (
              <tr key={ri}>
                {row.map((v, ci) => (
                  <td
                    key={ci}
                    className={`${cellBase} bg-background ${ci === 0 ? `${col0} z-10 border-l` : ci === 1 ? `${col1} z-10` : ""} ${
                      ci >= 2 && ci !== b.remarksCol ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {fmtNum(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {hasData && (
          <tfoot>
            <tr>
              <td className={`${cellBase} ${col0} sticky bottom-0 z-30 bg-muted font-bold border-l`}></td>
              <td className={`${cellBase} ${col1} sticky bottom-0 z-30 bg-muted font-bold`}>Total</td>
              {Array.from({ length: NUM - 2 }, (_, i) => i + 2).map((ci) => (
                <td
                  key={ci}
                  className={`${cellBase} sticky bottom-0 z-20 bg-muted font-bold ${
                    ci === b.remarksCol ? "" : "text-right tabular-nums"
                  }`}
                >
                  {ci === b.remarksCol ? "" : fmtNum(colTotals[ci])}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
