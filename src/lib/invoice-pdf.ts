import PDFDocument from "pdfkit";
import { formatCents } from "@/lib/utils";

type InvoiceForPdf = {
  number: string | null;
  status: string;
  issueDate: Date | null;
  dueDate: Date | null;
  subtotalCents: number;
  taxRatePercent: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  lines: { description: string; quantity: number; unitPriceCents: number; totalCents: number }[];
  business: {
    name: string; address: string | null; email: string; phone: string | null;
    siret: string | null; vatNumber: string | null;
  };
  customer: { fullName: string; email: string | null; phone: string | null };
};

/** Streams a simple, legally-usable invoice PDF (pdfkit — no headless browser needed). */
export function renderInvoicePdf(inv: InvoiceForPdf): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.fontSize(20).font("Helvetica-Bold").text(inv.business.name);
  doc.fontSize(9).font("Helvetica").fillColor("#555")
    .text([inv.business.address, inv.business.phone, inv.business.email].filter(Boolean).join(" · "))
    .text(inv.business.siret ? `SIRET : ${inv.business.siret}` : "");
  doc.fillColor("#000");
  doc.moveDown(1.5);

  doc.fontSize(16).font("Helvetica-Bold")
    .text(inv.status === "draft" ? "FACTURE — BROUILLON" : `FACTURE ${inv.number}`);
  doc.fontSize(9).font("Helvetica").fillColor("#555")
    .text(`Date d'émission : ${inv.issueDate ? inv.issueDate.toLocaleDateString("fr-FR") : "—"}`)
    .text(inv.dueDate ? `Échéance : ${inv.dueDate.toLocaleDateString("fr-FR")}` : "");
  doc.fillColor("#000");
  doc.moveDown(1);

  doc.fontSize(10).font("Helvetica-Bold").text("Facturé à :");
  doc.font("Helvetica").text(inv.customer.fullName);
  if (inv.customer.email) doc.text(inv.customer.email);
  if (inv.customer.phone) doc.text(inv.customer.phone);
  doc.moveDown(1.5);

  const tableTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Description", 50, tableTop);
  doc.text("Qté", 330, tableTop, { width: 40, align: "right" });
  doc.text("Prix U.", 380, tableTop, { width: 70, align: "right" });
  doc.text("Total", 460, tableTop, { width: 85, align: "right" });
  doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor("#ccc").stroke();

  let y = tableTop + 20;
  doc.font("Helvetica").fontSize(9);
  for (const line of inv.lines) {
    doc.text(line.description, 50, y, { width: 270 });
    doc.text(String(line.quantity), 330, y, { width: 40, align: "right" });
    doc.text(formatCents(line.unitPriceCents), 380, y, { width: 70, align: "right" });
    doc.text(formatCents(line.totalCents), 460, y, { width: 85, align: "right" });
    y += 18;
  }
  doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor("#ccc").stroke();
  y += 14;

  doc.text("Sous-total", 380, y, { width: 70, align: "right" });
  doc.text(formatCents(inv.subtotalCents), 460, y, { width: 85, align: "right" });
  y += 16;
  if (inv.taxRatePercent > 0) {
    doc.text(`TVA (${inv.taxRatePercent}%)`, 380, y, { width: 70, align: "right" });
    doc.text(formatCents(inv.taxCents), 460, y, { width: 85, align: "right" });
    y += 16;
  }
  doc.font("Helvetica-Bold");
  doc.text("Total", 380, y, { width: 70, align: "right" });
  doc.text(formatCents(inv.totalCents), 460, y, { width: 85, align: "right" });
  doc.font("Helvetica");
  y += 30;

  if (inv.notes) {
    doc.fontSize(9).text(inv.notes, 50, y, { width: 495 });
    y = doc.y + 20;
  }

  doc.fontSize(8).fillColor("#888");
  const legalFooter = inv.business.vatNumber
    ? `TVA intracommunautaire : ${inv.business.vatNumber}. Pas d'escompte pour paiement anticipé.`
    : "TVA non applicable, art. 293 B du CGI. Pas d'escompte pour paiement anticipé.";
  doc.text(legalFooter, 50, 770, { width: 495, align: "center" });

  doc.end();
  return doc;
}
