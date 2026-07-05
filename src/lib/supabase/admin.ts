import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. SERVER ONLY.
 * Used exclusively by: public booking flow, Stripe webhooks, cron, platform admin.
 * Every query made with this client MUST be explicitly scoped (by slug/id/token).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
