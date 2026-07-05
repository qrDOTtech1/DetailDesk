import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DetailDesk — Réservation pour auto detailers",
  description:
    "Ton lien de réservation pro pour le detailing, avec acompte, rappels et historique client.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
