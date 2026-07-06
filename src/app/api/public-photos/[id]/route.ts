import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * PUBLIC photo route — consent is re-checked on EVERY request:
 * shareable + publicly visible + active `public_photos` consent from the
 * customer the photo belongs to. Revoking consent hides photos immediately.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const photo = await db.bookingPhoto.findUnique({
    where: { id },
    include: { booking: { select: { customerId: true } }, vehicle: { select: { customerId: true } } },
  });
  if (!photo || !photo.isShareable || !photo.isPublicVisible) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const ownerId = photo.customerId ?? photo.booking?.customerId ?? photo.vehicle?.customerId;
  if (!ownerId) return NextResponse.json({ error: "not found" }, { status: 404 });

  const consent = await db.customerConsent.findUnique({
    where: { customerId_consentType: { customerId: ownerId, consentType: "public_photos" } },
  });
  if (!consent?.granted) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(Buffer.from(photo.data), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "public, max-age=300" },
  });
}
