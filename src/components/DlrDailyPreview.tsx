import { DlrMatrix } from "@/lib/dlr-daily";

export function DlrDailyPreview({ matrix }: { matrix: DlrMatrix }) {
  const b = matrix.bands;
  const NUM = b.numCols;

  const fmtNum = (v: any) => {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return v === 0 ? "-" : v.toLocaleString();
    return String(v);
  };
  const fmtPct = (v: any) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "-");

  return (
    <div className="overflow-auto border rounded-md">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr>
            <th colSpan={NUM} className="border bg-muted text-center font-bold py-2 whitespace-pre-line">
              {matrix.cells[0][0]}
            </th>
          </tr>
          <tr>
            <th rowSpan={2} className="border bg-muted px-2 py-1 align-middle">Sl.No.</th>
            <th rowSpan={2} className="border bg-muted px-2 py-1 align-middle">Name of the Project</th>
            {b.depts.map((d, i) => (
              <th key={i} colSpan={d.categories.length} className="border bg-muted px-2 py-1 text-center">{d.name}</th>
            ))}
            {b.totalLabourWidth > 1 ? (
              <th colSpan={b.totalLabourWidth} className="border bg-muted px-2 py-1 text-center">Total Labour</th>
            ) : (
              <th rowSpan={2} className="border bg-muted px-2 py-1 align-middle text-center">Total Labour</th>
            )}
            <th rowSpan={2} className="border bg-muted px-2 py-1 align-middle">Total</th>
            {b.pctTotalCol !== null && (
              <th rowSpan={2} className="border bg-muted px-2 py-1 align-middle">NMR % on Total</th>
            )}
            <th rowSpan={2} className="border bg-muted px-2 py-1 align-middle">Remarks</th>
          </tr>
          <tr>
            {b.catCols.map((c) => (
              <th key={c.id} className="border bg-muted px-2 py-1">{c.name}</th>
            ))}
            {b.totalLabourWidth > 1 && b.natureValues.map((v) => (
              <th key={v} className="border bg-muted px-2 py-1">{v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.cells.slice(matrix.headerRows).map((row, idx) => {
            const ri = idx + matrix.headerRows;
            if (matrix.sectionRows.includes(ri)) {
              return (
                <tr key={ri}>
                  <td className="border px-2 py-1 font-semibold bg-accent/20"></td>
                  <td colSpan={NUM - 1} className="border px-2 py-1 font-semibold bg-accent/20">{row[1]}</td>
                </tr>
              );
            }
            return (
              <tr key={ri}>
                {row.map((v, ci) => {
                  const isPct = b.pctTotalCol !== null && ci === b.pctTotalCol;
                  return (
                    <td key={ci} className={`border px-2 py-1 ${ci >= 2 && ci !== b.remarksCol ? "text-right tabular-nums" : ""}`}>
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
