import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionProfileId } from "@/lib/auth";

/**
 * Serves a booking photo. Access: members of the photo's business, or a
 * platform admin. Photos are internal work-proof material, not public.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profileId = await getSessionProfileId();
  if (!profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const photo = await db.bookingPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [member, profile] = await Promise.all([
    db.businessMember.findFirst({ where: { userId: profileId, businessId: photo.businessId } }),
    db.profile.findUnique({ where: { id: profileId }, select: { platformRole: true } }),
  ]);
  if (!member && profile?.platformRole !== "platform_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return new NextResponse(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
