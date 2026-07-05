import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export function formatDateTime(iso: string, timeZone = "Europe/Paris") {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Deposit amount in cents for a service + total. */
export function computeDeposit(s: {
  deposit_required: boolean;
  deposit_type: "fixed" | "percent";
  deposit_value: number;
  price_cents: number;
}) {
  if (!s.deposit_required) return 0;
  if (s.deposit_type === "fixed") return s.deposit_value;
  return Math.round((s.price_cents * s.deposit_value) / 100);
}
