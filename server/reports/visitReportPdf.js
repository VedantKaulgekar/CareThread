const PDFDocument = require("pdfkit");

const INK = "#1a1a2e";
const INK_SOFT = "#6b6f8a";
const PURPLE = "#4b3ea8";
const LINE = "#e5e1f5";
const PAPER_RAISED = "#f7f5fc";

const STAGE_LABEL = {
  pre_dosage: "Pre-dosage",
  post_dosage: "Post-dosage",
  general: "General",
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readingsLine(v) {
  const parts = [
    v.temperature != null && `Temp ${v.temperature}°F`,
    v.bp_systolic != null &&
      v.bp_diastolic != null &&
      `BP ${v.bp_systolic}/${v.bp_diastolic}`,
    v.sugar != null && `Sugar ${v.sugar} mg/dL`,
    v.spo2 != null && `SpO2 ${v.spo2}%`,
    v.heart_rate != null && `HR ${v.heart_rate} bpm`,
  ].filter(Boolean);
  return parts.length ? parts.join("   ·   ") : "No readings recorded";
}

function sectionHeader(doc, text) {
  doc.x = doc.page.margins.left;
  doc.moveDown(0.6);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(PURPLE)
    .text(text.toUpperCase(), doc.page.margins.left, doc.y, {
      characterSpacing: 0.6,
    });
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(LINE)
    .lineWidth(1)
    .stroke();
  doc.x = doc.page.margins.left;
  doc.moveDown(0.8);
}

function infoRow(doc, label, value) {
  const startX = doc.page.margins.left;
  const valueX = startX + 120;
  const valueWidth = doc.page.width - doc.page.margins.right - valueX;
  const y = doc.y;

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(INK_SOFT)
    .text(label, startX, y, { width: 110 });
  const valueHeight = doc.heightOfString(value || "—", { width: valueWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(INK)
    .text(value || "—", valueX, y, {
      width: valueWidth,
    });

  doc.x = startX;
  doc.y = y + Math.max(valueHeight, 14) + 6;
}

/**
 * @param {import('http').ServerResponse} res - Express response, headers
 *   already set (Content-Type/Content-Disposition) by the caller.
 * @param {object} data
 */
function streamVisitReport(res, data) {
  const {
    workspaceTitle,
    drugName,
    visitTitle,
    scheduledAt,
    completedAt,
    roomCode,
    doctorName,
    patientName,
    vitalsRows,
    aiSummary,
  } = data;

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  // ---------- Header band ----------
  doc.rect(0, 0, doc.page.width, 96).fill(PURPLE);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("CareThread", 50, 30);
  doc
    .fillColor("#e4e0f7")
    .font("Helvetica")
    .fontSize(11)
    .text("Visit Report", 50, 60);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(roomCode, 0, 40, {
      align: "right",
      width: doc.page.width - 50,
    });

  doc.y = 130;
  doc.x = 50;

  // ---------- Overview ----------
  doc
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(INK)
    .text(visitTitle || "Trial Visit");
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(INK_SOFT)
    .text(`${workspaceTitle} · ${drugName}`);
  doc.moveDown(1);

  infoRow(doc, "Doctor", doctorName);
  infoRow(doc, "Patient", patientName);
  infoRow(doc, "Scheduled for", fmtDate(scheduledAt));
  infoRow(doc, "Completed at", fmtDate(completedAt));

  // ---------- AI Summary ----------
  sectionHeader(doc, "After-visit summary");
  if (aiSummary) {
    const boxTop = doc.y;
    doc.font("Helvetica").fontSize(11).fillColor(INK);
    const textHeight = doc.heightOfString(aiSummary, {
      width:
        doc.page.width - doc.page.margins.left - doc.page.margins.right - 28,
    });
    doc
      .roundedRect(
        doc.page.margins.left,
        boxTop - 8,
        doc.page.width - doc.page.margins.left - doc.page.margins.right,
        textHeight + 24,
        8,
      )
      .fill(PAPER_RAISED);
    doc.fillColor(INK).text(aiSummary, doc.page.margins.left + 14, boxTop + 4, {
      width:
        doc.page.width - doc.page.margins.left - doc.page.margins.right - 28,
    });
    doc.y = boxTop + textHeight + 24;
  } else {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10.5)
      .fillColor(INK_SOFT)
      .text("No AI summary was generated for this visit.");
  }

  // ---------- Vitals by stage ----------
  sectionHeader(doc, "Recorded vitals");

  if (!vitalsRows || vitalsRows.length === 0) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10.5)
      .fillColor(INK_SOFT)
      .text("No vitals were recorded during this visit.");
  } else {
    vitalsRows.forEach((v, idx) => {
      if (doc.y > doc.page.height - 160) doc.addPage();

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(PURPLE)
        .text(STAGE_LABEL[v.stage] || v.stage);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(readingsLine(v));

      if (v.dosage_given) {
        doc.moveDown(0.2);
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(INK_SOFT)
          .text("Dosage given: ", { continued: true });
        doc.font("Helvetica").fillColor(INK).text(v.dosage_given);
      }
      if (v.doctor_notes) {
        doc.moveDown(0.2);
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(INK_SOFT)
          .text("Doctor notes: ", { continued: true });
        doc.font("Helvetica").fillColor(INK).text(v.doctor_notes);
      }
      if (idx < vitalsRows.length - 1) doc.moveDown(0.8);
    });
  }

  // ---------- Footer ----------
  const footerText =
    "Generated by CareThread — reflects information recorded in the app, not a substitute for the official clinical record.";
  const footerWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font("Helvetica").fontSize(8);
  const footerHeight = doc.heightOfString(footerText, { width: footerWidth });
  const footerY = doc.page.height - doc.page.margins.bottom - footerHeight - 10;
  doc.fillColor(INK_SOFT).text(footerText, doc.page.margins.left, footerY, {
    width: footerWidth,
    align: "center",
  });

  doc.end();
}

module.exports = { streamVisitReport };
