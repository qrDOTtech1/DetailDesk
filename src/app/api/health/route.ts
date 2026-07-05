import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, env: process.env.APP_ENV ?? "unknown" });
}
