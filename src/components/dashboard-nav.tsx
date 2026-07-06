"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  ["/dashboard", "Aperçu"],
  ["/dashboard/calendar", "Planning"],
  ["/dashboard/bookings", "Réservations"],
  ["/dashboard/invoices", "Factures"],
  ["/dashboard/services", "Services"],
  ["/dashboard/customers", "Clients"],
  ["/dashboard/availability", "Disponibilités"],
  ["/dashboard/settings", "Réglages"],
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex items-center gap-1 overflow-x-auto">
      {items.map(([href, label]) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
