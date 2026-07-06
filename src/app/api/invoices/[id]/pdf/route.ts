import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireBusiness();

  const invoice = await db.invoice.findFirst({
    where: { id, businessId: ctx.business.id },
    include: { lines: { orderBy: { sortOrder: "asc" } }, customer: true, business: true },
  });
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });

  const doc = renderInvoicePdf({
    number: invoice.number, status: invoice.status,
    issueDate: invoice.issueDate, dueDate: invoice.dueDate,
    subtotalCents: invoice.subtotalCents, taxRatePercent: invoice.taxRatePercent,
    taxCents: invoice.taxCents, totalCents: invoice.totalCents, notes: invoice.notes,
    lines: invoice.lines, business: invoice.business, customer: invoice.customer,
  });

  const chunks: Buffer[] = [];
  const buffer: Buffer = await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${invoice.number ?? "brouillon"}.pdf"`,
    },
  });
}
