import { formatCents, formatDateTime } from "@/lib/utils";

const layout = (title: string, body: string, footer = "") => `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Segoe UI,Arial,sans-serif;color:#18181b;">
<div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:8px;border:1px solid #e4e4e7;overflow:hidden;">
  <div style="padding:20px 28px;border-bottom:1px solid #e4e4e7;">
    <strong style="font-size:16px;">${title}</strong>
  </div>
  <div style="padding:24px 28px;font-size:14px;line-height:1.6;">${body}</div>
  <div style="padding:16px 28px;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a;">
    ${footer || "Envoyé via DetailDesk — réservation pour le detailing."}
  </div>
</div></body></html>`;

type BookingInfo = {
  businessName: string;
  customerName: string;
  serviceName: string;
  startsAt: string;
  timezone: string;
  totalCents: number;
  depositCents: number;
  cancelUrl?: string;
};

export function welcomeEmail(name: string) {
  return {
    subject: "Bienvenue sur DetailDesk",
    html: layout(
      "Bienvenue sur DetailDesk 👋",
      `<p>Bonjour ${name || ""},</p>
       <p>Votre compte est prêt. Prochaines étapes :</p>
       <ol><li>Créez votre business</li><li>Ajoutez vos services</li><li>Connectez Stripe pour les acomptes</li><li>Partagez votre lien de réservation</li></ol>
       <p>Bon detailing !</p>`
    ),
  };
}

export function bookingConfirmationEmail(b: BookingInfo) {
  return {
    subject: `Réservation confirmée — ${b.businessName}`,
    html: layout(
      `Réservation confirmée chez ${b.businessName}`,
      `<p>Bonjour ${b.customerName},</p>
       <p>Votre réservation est enregistrée :</p>
       <table style="width:100%;font-size:14px;">
         <tr><td style="padding:4px 0;color:#71717a;">Service</td><td><strong>${b.serviceName}</strong></td></tr>
         <tr><td style="padding:4px 0;color:#71717a;">Date</td><td><strong>${formatDateTime(b.startsAt, b.timezone)}</strong></td></tr>
         <tr><td style="padding:4px 0;color:#71717a;">Prix total</td><td>${formatCents(b.totalCents)}</td></tr>
         ${b.depositCents > 0 ? `<tr><td style="padding:4px 0;color:#71717a;">Acompte</td><td>${formatCents(b.depositCents)}</td></tr>` : ""}
       </table>
       ${b.cancelUrl ? `<p style="margin-top:16px;">Besoin d'annuler ? <a href="${b.cancelUrl}">Annuler ma réservation</a></p>` : ""}`,
      `Réservation chez ${b.businessName}.`
    ),
  };
}

export function paymentConfirmationEmail(b: BookingInfo) {
  return {
    subject: `Acompte reçu — ${b.businessName}`,
    html: layout(
      "Paiement d'acompte confirmé ✅",
      `<p>Bonjour ${b.customerName},</p>
       <p>Nous avons bien reçu votre acompte de <strong>${formatCents(b.depositCents)}</strong> pour :</p>
       <p><strong>${b.serviceName}</strong> — ${formatDateTime(b.startsAt, b.timezone)}</p>
       <p>Reste à régler sur place : ${formatCents(b.totalCents - b.depositCents)}.</p>`,
      `Paiement traité pour ${b.businessName}.`
    ),
  };
}

export function bookingReminderEmail(b: BookingInfo, customMessage?: string | null) {
  return {
    subject: `Rappel — RDV ${b.businessName} ${formatDateTime(b.startsAt, b.timezone)}`,
    html: layout(
      "Rappel de rendez-vous ⏰",
      `<p>Bonjour ${b.customerName},</p>
       <p>Petit rappel de votre rendez-vous :</p>
       <p><strong>${b.serviceName}</strong> chez <strong>${b.businessName}</strong><br/>
       ${formatDateTime(b.startsAt, b.timezone)}</p>
       ${customMessage ? `<p>${customMessage}</p>` : ""}
       ${b.cancelUrl ? `<p>Empêchement ? <a href="${b.cancelUrl}">Annuler la réservation</a></p>` : ""}`
    ),
  };
}

export function reviewRequestEmail(args: {
  businessName: string; customerName: string; serviceName: string; reviewUrl: string;
}) {
  return {
    subject: `Ton avis compte — ${args.businessName}`,
    html: layout(
      `Merci pour ta visite chez ${args.businessName} !`,
      `<p>Bonjour ${args.customerName},</p>
       <p>Merci d'avoir fait confiance à ${args.businessName} pour ton <strong>${args.serviceName}</strong>.</p>
       <p>Si tu es satisfait du résultat, un avis Google prend 30 secondes et aide énormément :</p>
       <p style="text-align:center;margin:20px 0;">
         <a href="${args.reviewUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;">Laisser un avis ⭐</a>
       </p>
       <p>Merci beaucoup !</p>`,
      `Message envoyé au nom de ${args.businessName}.`
    ),
  };
}

export function rebookingEmail(args: {
  businessName: string; customerName: string; serviceName: string; bookingUrl: string; days: number;
}) {
  return {
    subject: `C'est le moment de refaire briller ta voiture — ${args.businessName}`,
    html: layout(
      "Il est temps de reprendre rendez-vous 🚗",
      `<p>Bonjour ${args.customerName},</p>
       <p>Ça fait environ ${args.days} jours depuis ton dernier <strong>${args.serviceName}</strong> chez ${args.businessName}.</p>
       <p>Pour garder ta voiture au top, c'est le bon moment pour reprendre rendez-vous :</p>
       <p style="text-align:center;margin:20px 0;">
         <a href="${args.bookingUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;">Réserver un créneau</a>
       </p>`,
      `Message envoyé au nom de ${args.businessName}.`
    ),
  };
}

export function newBookingProEmail(args: {
  customerName: string; customerPhone?: string | null; serviceName: string;
  startsAt: string; timezone: string; totalCents: number; depositCents: number;
  depositPaid: boolean; vehicle?: string | null; dashboardUrl: string;
}) {
  return {
    subject: `Nouvelle réservation — ${args.customerName}, ${formatDateTime(args.startsAt, args.timezone)}`,
    html: layout(
      "Nouvelle réservation 📅",
      `<table style="width:100%;font-size:14px;">
         <tr><td style="padding:4px 0;color:#71717a;">Client</td><td><strong>${args.customerName}</strong>${args.customerPhone ? ` — ${args.customerPhone}` : ""}</td></tr>
         <tr><td style="padding:4px 0;color:#71717a;">Service</td><td>${args.serviceName}</td></tr>
         ${args.vehicle ? `<tr><td style="padding:4px 0;color:#71717a;">Véhicule</td><td>${args.vehicle}</td></tr>` : ""}
         <tr><td style="padding:4px 0;color:#71717a;">Date</td><td><strong>${formatDateTime(args.startsAt, args.timezone)}</strong></td></tr>
         <tr><td style="padding:4px 0;color:#71717a;">Total</td><td>${formatCents(args.totalCents)}</td></tr>
         ${args.depositCents > 0 ? `<tr><td style="padding:4px 0;color:#71717a;">Acompte</td><td>${formatCents(args.depositCents)} ${args.depositPaid ? "✅ payé" : "⏳ en attente de paiement"}</td></tr>` : ""}
       </table>
       <p style="text-align:center;margin:20px 0;">
         <a href="${args.dashboardUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;">Voir la réservation</a>
       </p>`,
      "Notification DetailDesk."
    ),
  };
}

export function portalMagicLinkEmail(args: { businessName: string; loginUrl: string }) {
  return {
    subject: `Ton espace client — ${args.businessName}`,
    html: layout(
      `Connexion à ton espace client`,
      `<p>Bonjour,</p>
       <p>Clique sur le bouton ci-dessous pour accéder à ton espace client chez <strong>${args.businessName}</strong> (lien valable 15 minutes, utilisable une seule fois) :</p>
       <p style="text-align:center;margin:20px 0;">
         <a href="${args.loginUrl}" style="display:inline-block;background:#1e293b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;">Accéder à mon espace</a>
       </p>
       <p>Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>`,
      `Espace client ${args.businessName}.`
    ),
  };
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: "Réinitialise ton mot de passe DetailDesk",
    html: layout(
      "Réinitialisation du mot de passe",
      `<p>Tu as demandé à réinitialiser ton mot de passe.</p>
       <p><a href="${resetUrl}">Clique ici pour choisir un nouveau mot de passe</a> (valable 1 heure).</p>
       <p>Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`
    ),
  };
}

export function bookingCancelledEmail(b: BookingInfo) {
  return {
    subject: `Réservation annulée — ${b.businessName}`,
    html: layout(
      "Réservation annulée",
      `<p>Bonjour ${b.customerName},</p>
       <p>Votre réservation <strong>${b.serviceName}</strong> du ${formatDateTime(b.startsAt, b.timezone)} chez ${b.businessName} a bien été annulée.</p>
       <p>Vous pouvez réserver un nouveau créneau à tout moment.</p>`
    ),
  };
}
