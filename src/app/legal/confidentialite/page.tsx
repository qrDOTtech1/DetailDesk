export const metadata = { title: "Politique de confidentialité — DetailDesk" };

export default function Confidentialite() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>Dernière mise à jour : juillet 2026. Responsable de traitement : Matable.pro.</p>

      <h2>1. Données collectées</h2>
      <p>Pour les <strong>Professionnels</strong> : email, nom, mot de passe (haché), informations du business, données de facturation (via Stripe).</p>
      <p>
        Pour les <strong>clients finaux</strong> des Professionnels : nom, email, téléphone,
        informations du véhicule (marque, modèle, plaque éventuelle), historique de
        réservations, et le cas échéant photos du véhicule avant/après prestation.
        Chaque Professionnel est responsable des données de ses propres clients ;
        Matable.pro agit comme sous-traitant au sens du RGPD.
      </p>

      <h2>2. Finalités</h2>
      <ul className="list-disc pl-5">
        <li>Gestion des réservations, rappels et confirmations (email/SMS)</li>
        <li>Paiement des acomptes (Stripe) et de l&apos;abonnement</li>
        <li>Relances de rebooking et demandes d&apos;avis, pour le compte du Professionnel</li>
        <li>Espace client accessible par lien de connexion email</li>
      </ul>

      <h2>3. Photos et consentement</h2>
      <p>
        Les photos de véhicules sont <strong>privées par défaut</strong>. Une photo ne peut
        apparaître dans la galerie publique d&apos;un Professionnel que si celui-ci la marque
        comme partageable <strong>et</strong> que le client a donné un consentement explicite,
        horodaté et révocable à tout moment (depuis son espace client ou sur simple demande).
        La révocation retire immédiatement les photos de toute page publique.
      </p>

      <h2>4. Sous-traitants</h2>
      <p>
        Railway (hébergement, USA), Stripe (paiements), Resend (emails), ClickSend (SMS).
        Des clauses contractuelles types encadrent les transferts hors UE.
      </p>

      <h2>5. Durées de conservation</h2>
      <p>
        Les données sont conservées pendant la durée d&apos;utilisation du service, puis
        supprimées sur demande ou après résiliation du compte du Professionnel concerné.
      </p>

      <h2>6. Tes droits</h2>
      <p>
        Accès, rectification, effacement, opposition, portabilité : écris à{" "}
        <a href="mailto:contact@matable.pro" className="underline">contact@matable.pro</a>.
        Pour les données te concernant en tant que client final d&apos;un Professionnel, tu peux
        aussi t&apos;adresser directement à celui-ci. Tu peux saisir la CNIL en cas de litige.
      </p>

      <h2>7. Cookies</h2>
      <p>
        DetailDesk n&apos;utilise que des cookies strictement nécessaires (session de connexion
        des Professionnels et de l&apos;espace client). Aucun cookie publicitaire ou de suivi.
      </p>
    </>
  );
}
