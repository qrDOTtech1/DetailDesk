import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

/** Guards dashboard/admin/onboarding routes by checking the signed session cookie. */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/onboarding");
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const profileId = token ? await verifySession(token) : null;

  if (!profileId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding"],
};
