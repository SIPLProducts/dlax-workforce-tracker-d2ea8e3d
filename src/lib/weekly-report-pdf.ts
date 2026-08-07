import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { WeeklyMatrix } from "./weekly-report";
import { weeklyDateRangeLabel } from "./weekly-report";
import { KPC_LOGO_DATA_URL, KPC_LOGO_W, KPC_LOGO_H } from "./kpc-logo-data";


const fmt = (n: number) => (n ? n.toLocaleString() : "");

export function downloadWeeklyReportPdf(m: WeeklyMatrix, filename: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 8;

  // Header band
  const bandY = 8;
  const bandH = 18;
  doc.setLineWidth(0.3);
  doc.rect(marginX, bandY, pageW - marginX * 2, bandH);

  const col1W = 90;
  const col3W = 30;
  const col2X = marginX + col1W;
  const col3X = pageW - marginX - col3W;
  doc.line(col2X, bandY, col2X, bandY + bandH);
  doc.line(col3X, bandY, col3X, bandY + bandH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const projLabel = m.project.name || m.project.code || "";
  doc.text(`Name of the Project: ${projLabel}`, marginX + 2, bandY + 7);
  doc.text(`Date: ${weeklyDateRangeLabel(m)}`, marginX + 2, bandY + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("KPC PROJECTS LTD", col2X + (col3X - col2X) / 2, bandY + 8, { align: "center" });
  doc.setFontSize(11);
  doc.text("WEEKLY LABOUR REPORT", col2X + (col3X - col2X) / 2, bandY + 15, { align: "center" });

  // KPC logo in the right-hand header cell, scaled to fit with padding
  const pad = 3;
  const maxW = col3W - pad * 2;
  const maxH = bandH - pad * 2;
  const scale = Math.min(maxW / KPC_LOGO_W, maxH / KPC_LOGO_H);
  const logoW = KPC_LOGO_W * scale;
  const logoH = KPC_LOGO_H * scale;
  doc.addImage(
    KPC_LOGO_DATA_URL,
    "PNG",
    col3X + (col3W - logoW) / 2,
    bandY + (bandH - logoH) / 2,
    logoW,
    logoH,
  );


  // Table
  const N = m.days.length;
  const dayLabels = m.days.map((d) => format(d, "EEE\ndd.MM"));
  const head = [
    [
      { content: "S.No", rowSpan: 2 },
      { content: "SC Code", rowSpan: 2 },
      { content: "Name of the Contractor", rowSpan: 2 },
      { content: "Nature of Work", rowSpan: 2 },
      ...dayLabels.map((lbl) => ({ content: lbl, colSpan: 2 })),
      { content: "Total IR", rowSpan: 2 },
      { content: "Total NMR", rowSpan: 2 },
      { content: "Total Labour", rowSpan: 2 },
      { content: `Per Day Avg (Total/${N})`, rowSpan: 2 },
    ],
    [
      ...m.days.flatMap(() => [{ content: "IR" }, { content: "NMR" }]),
    ],
  ];

  const body = m.rows.map((r, i) => [
    String(i + 1),
    r.code || "",
    r.name,
    r.nature || "",
    ...r.days.flatMap((d) => [fmt(d.ir), fmt(d.nmr)]),
    fmt(r.totalIR),
    fmt(r.totalNMR),
    fmt(r.totalWeek),
    r.perWeek ? r.perWeek.toString() : "",
  ]);

  const foot = [[
    { content: "Totals", colSpan: 4, styles: { halign: "right", fontStyle: "bold" as const } },
    ...m.totals.days.flatMap((d) => [fmt(d.ir), fmt(d.nmr)]),
    fmt(m.totals.totalIR),
    fmt(m.totals.totalNMR),
    fmt(m.totals.totalWeek),
    m.totals.perWeek ? m.totals.perWeek.toString() : "",
  ]];

  autoTable(doc, {
    head: head as any,
    body,
    foot: foot as any,
    startY: bandY + bandH + 3,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 7.5, cellPadding: 1.2, halign: "center", valign: "middle", lineWidth: 0.1, lineColor: [0, 0, 0] },
    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: "bold", lineWidth: 0.1, lineColor: [0, 0, 0] },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", lineWidth: 0.1, lineColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 16 },
      2: { cellWidth: 38, halign: "left" },
      3: { cellWidth: 24, halign: "left" },
    },
    theme: "grid",
  });


  doc.save(filename);
}
