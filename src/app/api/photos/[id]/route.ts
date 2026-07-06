import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionProfileId } from "@/lib/auth";
import { getPortalSession } from "@/lib/portal-auth";

/**
 * Serves a photo. Access: members of the photo's business, platform admins,
 * or the portal customer the photo belongs to. Never public — the public
 * gallery has its own consent-checked route.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const photo = await db.bookingPhoto.findUnique({
    where: { id },
    include: { booking: { select: { customerId: true } }, vehicle: { select: { customerId: true } } },
  });
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });

  let allowed = false;

  const profileId = await getSessionProfileId();
  if (profileId) {
    const [member, profile] = await Promise.all([
      db.businessMember.findFirst({ where: { userId: profileId, businessId: photo.businessId } }),
      db.profile.findUnique({ where: { id: profileId }, select: { platformRole: true } }),
    ]);
    allowed = Boolean(member) || profile?.platformRole === "platform_admin";
  }

  if (!allowed) {
    const portal = await getPortalSession();
    if (portal && portal.businessId === photo.businessId) {
      const owner = photo.customerId ?? photo.booking?.customerId ?? photo.vehicle?.customerId;
      allowed = owner === portal.customerId;
    }
  }

  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return new NextResponse(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
