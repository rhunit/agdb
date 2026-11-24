import type { ReportModel } from "./reportContent.js";

// The weekly report in the body of the e-mail: plain HTML with inline styles
// (what mail programs understand), same content and colours as the PDF.

const GREEN = "#24593a";
const FONT = "Verdana, 'DejaVu Sans', Arial, sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function table(head: string[], rows: string[][], width: number): string {
  const th = head
    .map((h) => `<th style="text-align:left;font-weight:400;padding:8px;background:#e3efe6;border-bottom:1px solid ${GREEN};">${esc(h)}</th>`)
    .join("");
  const trs = rows
    .map(
      (r, i) =>
        `<tr>${r
          .map((c) => `<td style="padding:8px;${i % 2 === 1 ? "background:#f5f8f6;" : ""}">${esc(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:12px;width:100%;max-width:${width}px;margin:0 0 6px;"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

const h2 = (s: string) => `<h2 style="margin:22px 0 8px;font-size:18px;color:${GREEN};">${esc(s)}</h2>`;
const p = (s: string) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.55;">${esc(s)}</p>`;

export function renderReportHtml(model: ReportModel, dashboardUrl: string | null): string {
  const glanceRows = [
    ...model.glance.map((g) => [g.name, ...[5, 4, 3, 2, 1].map((s) => String(g.counts[s as 1])), String(g.total), g.average, g.fivePct]),
    ["Totaal beschikbaar", ...[5, 4, 3, 2, 1].map((s) => String(model.glanceTotal.counts[s as 1])), String(model.glanceTotal.total), model.glanceTotal.average, model.glanceTotal.fivePct],
  ];
  const sections = model.sections
    .map(
      (s) =>
        h2(s.name) +
        p(s.starSentence) +
        (s.categories
          ? table(["Categorie", "1★", "2★", "3★", "Totaal"], s.categories.map((c) => [c.category, String(c.c1), String(c.c2), String(c.c3), String(c.total)]), 460)
          : "") +
        (s.paragraph ? p(s.paragraph) : ""),
    )
    .join("");

  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(model.title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:${FONT};">
<div style="max-width:680px;margin:0 auto;padding:24px 16px;">
<h1 style="margin:0 0 12px;font-size:24px;color:${GREEN};letter-spacing:0.3px;">${esc(model.title)}</h1>
${p(model.subtitle)}
${h2("De week in één oogopslag")}
${table(["Locatie", "5★", "4★", "3★", "2★", "1★", "Totaal", "Gem.", "5★ %"], glanceRows, 560)}
${p(model.overview)}
${model.monthStatus
    .map(
      (ms) =>
        h2(ms.title) +
        p(ms.intro) +
        table(
          ["Locatie", "5★", "4★", "1–3★", "Totaal", "5★ × €5", "1–3★ × −€10", "Stand"],
          [...ms.rows, ms.total].map((r) => [
            r.name, String(r.five), String(r.four), String(r.low), String(r.total), r.fiveEur, r.lowEur, r.net,
          ]),
          620,
        ),
    )
    .join("")}
${sections}
${h2("Datakwaliteit en vergelijkbaarheid")}
${p(model.dataQuality)}
${h2("Samen de nieuwe week in")}
${p(model.closing)}
<p style="margin:24px 0 0;font-size:12px;color:#6f5d58;">Het rapport staat ook als PDF in de bijlage.${
    dashboardUrl ? ` Bekijk alle reviews in het <a href="${esc(dashboardUrl)}" style="color:${GREEN};">dashboard</a>.` : ""
  }</p>
</div></body></html>`;
}
