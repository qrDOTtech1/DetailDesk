import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Serves logo/cover/gallery photos of the business's own workshop.
 * Public by design — these are meant to appear on the public booking page,
 * unlike client vehicle photos which require explicit consent.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await db.businessPhoto.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });

  return new NextResponse(Buffer.from(photo.data), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "public, max-age=3600" },
  });
}
