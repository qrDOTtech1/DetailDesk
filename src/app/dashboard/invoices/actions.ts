"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { Resend } from "resend";
import { z } from "zod";

type ActionState = { error?: string; success?: string } | null;

const lineSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(999),
  unit_price_euros: z.coerce.number().min(0).max(100_000),
});

const invoiceSchema = z.object({
  customer_id: z.string().uuid(),
  booking_id: z.string().uuid().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  tax_rate_percent: z.coerce.number().int().min(0).max(100).default(0),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

function computeTotals(lines: { unitPriceCents: number; quantity: number }[], taxRatePercent: number) {
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const taxCents = Math.round((subtotalCents * taxRatePercent) / 100);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Creates a draft invoice, optionally pre-filled from a completed booking (service + add-ons as lines). */
export async function createInvoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const customer = await db.customer.findFirst({
    where: { id: d.customer_id, businessId: ctx.business.id },
  });
  if (!customer) return { error: "Client introuvable." };

  let lines: { description: string; quantity: number; unitPriceCents: number; totalCents: number; sortOrder: number }[] = [];
  let bookingId: string | null = null;

  if (d.booking_id) {
    const booking = await db.booking.findFirst({
      where: { id: d.booking_id, businessId: ctx.business.id, customerId: customer.id },
      include: { service: true, bookingAddons: true },
    });
    if (!booking) return { error: "Réservation introuvable pour ce client." };
    bookingId = booking.id;
    lines = [
      { description: booking.service.name, quantity: 1, unitPriceCents: booking.service.priceCents, totalCents: booking.service.priceCents, sortOrder: 0 },
      ...booking.bookingAddons.map((a, i) => ({
        description: a.name, quantity: 1, unitPriceCents: a.priceCents, totalCents: a.priceCents, sortOrder: i + 1,
      })),
    ];
    if (booking.discountCents > 0) {
      lines.push({ description: "Remise", quantity: 1, unitPriceCents: -booking.discountCents, totalCents: -booking.discountCents, sortOrder: lines.length });
    }
  } else {
    // parse manual line items: description_0/qty_0/price_0 ...
    const raw = Object.fromEntries(formData);
    let i = 0;
    while (raw[`description_${i}`]) {
      const parsedLine = lineSchema.safeParse({
        description: raw[`description_${i}`], quantity: raw[`quantity_${i}`] ?? "1",
        unit_price_euros: raw[`unit_price_${i}`] ?? "0",
      });
      if (parsedLine.success) {
        const unitPriceCents = Math.round(parsedLine.data.unit_price_euros * 100);
        lines.push({
          description: parsedLine.data.description, quantity: parsedLine.data.quantity,
          unitPriceCents, totalCents: unitPriceCents * parsedLine.data.quantity, sortOrder: i,
        });
      }
      i++;
    }
    if (lines.length === 0) return { error: "Ajoute au moins une ligne." };
  }

  const totals = computeTotals(lines, d.tax_rate_percent);

  const invoice = await db.invoice.create({
    data: {
      businessId: ctx.business.id, customerId: customer.id, bookingId,
      dueDate: d.due_date ? new Date(d.due_date) : null,
      taxRatePercent: d.tax_rate_percent,
      notes: d.notes || null,
      ...totals,
      lines: { create: lines },
    },
  });

  redirect(`/dashboard/invoices/${invoice.id}`);
}

/** Assigns the next sequential invoice number (atomic, per business) and locks the invoice. */
export async function issueInvoice(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));

  const invoice = await db.invoice.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!invoice || invoice.status !== "draft") return;

  await db.$transaction(async (tx) => {
    const business = await tx.business.update({
      where: { id: ctx.business.id },
      data: { invoiceNextNumber: { increment: 1 } },
    });
    const seq = business.invoiceNextNumber - 1;
    const number = `${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
    await tx.invoice.update({
      where: { id },
      data: { status: "issued", number, issueDate: new Date() },
    });
  });

  revalidatePath(`/dashboard/invoices/${id}`);
  revalidatePath("/dashboard/invoices");
}

export async function markInvoicePaid(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  await db.invoice.updateMany({
    where: { id, businessId: ctx.business.id, status: "issued" },
    data: { status: "paid", paidAt: new Date() },
  });
  revalidatePath(`/dashboard/invoices/${id}`);
  revalidatePath("/dashboard/invoices");
}

export async function cancelInvoice(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  await db.invoice.updateMany({
    where: { id, businessId: ctx.business.id, status: { in: ["draft", "issued"] } },
    data: { status: "cancelled" },
  });
  revalidatePath(`/dashboard/invoices/${id}`);
  revalidatePath("/dashboard/invoices");
}

export async function deleteDraftInvoice(formData: FormData) {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));
  await db.invoice.deleteMany({ where: { id, businessId: ctx.business.id, status: "draft" } });
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

/** Emails the invoice PDF to the customer. */
export async function sendInvoiceEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireBusiness();
  const id = String(formData.get("id"));

  const invoice = await db.invoice.findFirst({
    where: { id, businessId: ctx.business.id },
    include: { lines: true, customer: true, business: true },
  });
  if (!invoice) return { error: "Facture introuvable." };
  if (!invoice.customer.email) return { error: "Ce client n'a pas d'email enregistré." };
  if (invoice.status === "draft") return { error: "Émets la facture avant de l'envoyer." };

  const doc = renderInvoicePdf({
    number: invoice.number, status: invoice.status,
    issueDate: invoice.issueDate, dueDate: invoice.dueDate,
    subtotalCents: invoice.subtotalCents, taxRatePercent: invoice.taxRatePercent,
    taxCents: invoice.taxCents, totalCents: invoice.totalCents, notes: invoice.notes,
    lines: invoice.lines, business: invoice.business, customer: invoice.customer,
  });
  const chunks: Buffer[] = [];
  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  if (!process.env.RESEND_API_KEY) {
    return { error: "Envoi email désactivé (pas de clé Resend configurée)." };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "DetailDesk <onboarding@resend.dev>",
      to: invoice.customer.email,
      replyTo: invoice.business.email,
      subject: `Facture ${invoice.number} — ${invoice.business.name}`,
      html: `<p>Bonjour ${invoice.customer.fullName},</p><p>Voici ta facture ${invoice.number} de ${invoice.business.name}, en pièce jointe.</p>`,
      attachments: [{ filename: `facture-${invoice.number}.pdf`, content: pdfBuffer }],
    });
  } catch (e) {
    return { error: "Envoi échoué : " + (e instanceof Error ? e.message : "inconnu") };
  }

  await sendEmail({
    type: "booking_confirmation", to: invoice.customer.email,
    subject: `Facture ${invoice.number}`, html: "(PDF envoyé en pièce jointe)",
    businessId: ctx.business.id,
  });

  return { success: "Facture envoyée par email." };
}
