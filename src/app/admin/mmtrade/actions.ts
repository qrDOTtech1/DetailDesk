"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { normalizeBotUrl } from "./botUrl";

async function callBot(path: string, options: RequestInit = {}) {
  const rawBase = process.env.MMTRADE_API_URL;
  const token = process.env.MMTRADE_API_TOKEN;
  if (!rawBase || !token) throw new Error("MMTRADE_API_URL / MMTRADE_API_TOKEN non configures");
  const base = normalizeBotUrl(rawBase);
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`bot ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function startBot() {
  await requirePlatformAdmin();
  await callBot("/api/start", { method: "POST" });
  revalidatePath("/admin/mmtrade");
}

export async function stopBot() {
  await requirePlatformAdmin();
  await callBot("/api/stop", { method: "POST" });
  revalidatePath("/admin/mmtrade");
}

export async function setSymbolMode(formData: FormData) {
  await requirePlatformAdmin();
  const symbol = String(formData.get("symbol"));
  const mode = String(formData.get("mode"));
  await callBot("/api/mode", { method: "POST", body: JSON.stringify({ symbol, mode }) });
  revalidatePath("/admin/mmtrade");
}

export async function resetKillswitch() {
  await requirePlatformAdmin();
  await callBot("/api/killswitch/reset", { method: "POST" });
  revalidatePath("/admin/mmtrade");
}

export async function setFloor(formData: FormData) {
  await requirePlatformAdmin();
  // le bot accepte 0 explicitement (voir set_floor : "if not (0 <= v <= 100000)")
  // -> laisser la valeur telle quelle, ne PAS la traiter comme falsy/absente.
  const floor = Number(formData.get("floor"));
  await callBot("/api/floor", { method: "POST", body: JSON.stringify({ floor }) });
  revalidatePath("/admin/mmtrade");
}

export async function updateKillswitchConfig(formData: FormData) {
  await requirePlatformAdmin();
  const body = {
    enabled: formData.get("enabled") === "on",
    cash_floor_usd: Number(formData.get("cash_floor_usd")),
    max_session_loss_usd: Number(formData.get("max_session_loss_usd")),
    max_global_consec_losses: Number(formData.get("max_global_consec_losses")),
  };
  await callBot("/api/killswitch", { method: "POST", body: JSON.stringify(body) });
  revalidatePath("/admin/mmtrade");
}
