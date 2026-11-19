import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import type { ReportModel } from "./reportContent.js";

// The weekly report as a PDF, made on the server (for the e-mail). Same
// layout as the browser export (app/src/components/WeekReport.module.css):
// A4, dark green headings, light green table headers, striped rows. DejaVu
// Sans is bundled (assets/fonts) for the look and for the ★ characters.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS = join(__dirname, "..", "assets", "fonts");

const GREEN = "#24593a";
const HEAD_BG = "#e3efe6";
const STRIPE = "#f5f8f6";
const MM = 72 / 25.4;
const MARGIN_X = 16 * MM;
const MARGIN_Y = 16 * MM;

export function renderReportPdf(model: ReportModel): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X },
    info: { Title: `Google Reviews weekrapport ${model.periodLabel}`, Author: "Amsterdam Genetics dashboard" },
  });
  doc.registerFont("regular", join(FONTS, "DejaVuSans.ttf"));
  doc.registerFont("bold", join(FONTS, "DejaVuSans-Bold.ttf"));

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const width = doc.page.width - 2 * MARGIN_X;
  const bottom = () => doc.page.height - MARGIN_Y;
  const ensure = (height: number) => {
    if (doc.y + height > bottom()) doc.addPage();
  };

  const text = (s: string, opts: { size?: number; gapAfter?: number } = {}) => {
    doc.font("regular").fontSize(opts.size ?? 10.5).fillColor("#111111");
    ensure(doc.heightOfString(s, { width, lineGap: 3 }) > 120 ? 40 : doc.heightOfString(s, { width, lineGap: 3 }));
    doc.text(s, MARGIN_X, doc.y, { width, lineGap: 3 });
    doc.moveDown((opts.gapAfter ?? 6) / 10.5);
  };

  const heading = (s: string, size = 13.5, keepWith = 90) => {
    ensure(size + 10 + keepWith);
    doc.moveDown(0.6);
    doc.font("bold").fontSize(size).fillColor(GREEN).text(s, MARGIN_X, doc.y, { width });
    doc.moveDown(0.45);
  };

  const ROW_H = 26;
  const table = (columns: { label: string; width: number }[], rows: string[][]) => {
    ensure(ROW_H * (rows.length + 1) + 4);
    const tableWidth = columns.reduce((n, c) => n + c.width, 0);
    let y = doc.y;
    const drawRow = (cells: string[], header: boolean, index: number) => {
      if (header) doc.rect(MARGIN_X, y, tableWidth, ROW_H).fill(HEAD_BG);
      else if (index % 2 === 1) doc.rect(MARGIN_X, y, tableWidth, ROW_H).fill(STRIPE);
      let x = MARGIN_X;
      doc.font("regular").fontSize(8).fillColor("#111111");
      cells.forEach((cell, i) => {
        doc.text(cell, x + 8, y + (ROW_H - 8) / 2 - 1, { width: columns[i].width - 12, lineBreak: false });
        x += columns[i].width;
      });
      if (header) {
        doc.moveTo(MARGIN_X, y + ROW_H).lineTo(MARGIN_X + tableWidth, y + ROW_H).lineWidth(0.8).strokeColor(GREEN).stroke();
      }
      y += ROW_H;
    };
    drawRow(columns.map((c) => c.label), true, -1);
    rows.forEach((r, i) => drawRow(r, false, i));
    doc.x = MARGIN_X;
    doc.y = y + 4;
  };

  // Title and subtitle
  doc.font("bold").fontSize(20).fillColor(GREEN).text(model.title, MARGIN_X, MARGIN_Y, { width });
  doc.moveDown(0.6);
  doc.font("regular").fontSize(10).fillColor("#111111").text(model.subtitle, { width });
  doc.moveDown(0.6);

  // De week in één oogopslag
  heading("De week in één oogopslag", 13.5, ROW_H * (model.glance.length + 2));
  const w = width * 0.78;
  const glanceCols = [0.3, 0.07, 0.07, 0.07, 0.07, 0.07, 0.1, 0.1, 0.15].map((f, i) => ({
    label: ["Locatie", "5★", "4★", "3★", "2★", "1★", "Totaal", "Gem.", "5★ %"][i],
    width: w * f,
  }));
  const glanceRow = (name: string, c: ReportModel["glanceTotal"]) => [
    name, String(c.counts[5]), String(c.counts[4]), String(c.counts[3]), String(c.counts[2]), String(c.counts[1]),
    String(c.total), c.average, c.fivePct,
  ];
  table(glanceCols, [...model.glance.map((g) => glanceRow(g.name, g)), glanceRow("Totaal beschikbaar", model.glanceTotal)]);
  text(model.overview);

  // Per location
  const catW = width * 0.65;
  const catCols = [0.36, 0.16, 0.16, 0.16, 0.16].map((f, i) => ({
    label: ["Categorie", "1★", "2★", "3★", "Totaal"][i],
    width: catW * f,
  }));
  for (const section of model.sections) {
    heading(section.name, 13.5, section.categories ? ROW_H * 5 + 30 : 30);
    text(section.starSentence);
    if (section.categories) {
      table(catCols, section.categories.map((c) => [c.category, String(c.c1), String(c.c2), String(c.c3), String(c.total)]));
      if (section.paragraph) text(section.paragraph);
    }
  }

  heading("Datakwaliteit en vergelijkbaarheid", 13.5, 60);
  text(model.dataQuality);
  heading("Samen de nieuwe week in", 13.5, 60);
  text(model.closing);

  doc.end();
  return done;
}
