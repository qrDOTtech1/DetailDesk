import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "dd_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(profileId: string): Promise<string> {
  return new SignJWT({ sub: profileId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/** Edge-compatible: verifies signature only, safe to call from middleware. */
export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
