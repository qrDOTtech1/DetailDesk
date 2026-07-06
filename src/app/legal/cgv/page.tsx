export const metadata = { title: "CGV — DetailDesk" };

export default function CGV() {
  return (
    <>
      <h1>Conditions générales de vente et d&apos;utilisation</h1>
      <p>Dernière mise à jour : juillet 2026. Éditeur : Matable.pro.</p>

      <h2>1. Objet</h2>
      <p>
        DetailDesk est un service SaaS de réservation et de gestion destiné aux professionnels
        du detailing automobile. Les présentes conditions régissent l&apos;abonnement des
        Professionnels au service et l&apos;utilisation des pages publiques de réservation par
        leurs clients finaux.
      </p>

      <h2>2. Abonnement et tarifs</h2>
      <p>
        L&apos;abonnement « DetailDesk Pro » est facturé <strong>29 € TTC par mois</strong>,
        sans engagement, après une période d&apos;essai gratuite de 14 jours. Il inclut
        l&apos;ensemble des fonctionnalités du service ainsi que 150 SMS de rappel par mois.
        Au-delà, les SMS supplémentaires sont facturés <strong>1 € par tranche de 10 SMS</strong>.
        Le paiement s&apos;effectue par carte via Stripe. L&apos;abonnement est résiliable à
        tout moment depuis l&apos;espace de facturation ; la résiliation prend effet à la fin
        de la période en cours.
      </p>

      <h2>3. Paiements des clients finaux</h2>
      <p>
        Les acomptes réglés par les clients finaux lors d&apos;une réservation sont encaissés
        directement sur le compte Stripe du Professionnel concerné, qui est seul vendeur de la
        prestation. Matable.pro n&apos;est pas partie au contrat de prestation entre le
        Professionnel et son client. Les conditions d&apos;annulation et de remboursement des
        acomptes sont celles affichées par chaque Professionnel sur sa page de réservation.
      </p>

      <h2>4. Obligations du Professionnel</h2>
      <p>
        Le Professionnel s&apos;engage à fournir des informations exactes, à honorer les
        réservations confirmées, à respecter la réglementation applicable à son activité et à
        n&apos;utiliser les données de ses clients (dont les photos de véhicules) que dans le
        cadre prévu par la politique de confidentialité et les consentements recueillis.
      </p>

      <h2>5. Disponibilité et responsabilité</h2>
      <p>
        Matable.pro s&apos;efforce d&apos;assurer une disponibilité maximale du service, sans
        garantie d&apos;absence d&apos;interruption. La responsabilité de Matable.pro est
        limitée au montant des sommes versées par le Professionnel au titre des trois derniers
        mois d&apos;abonnement. Matable.pro ne saurait être tenue responsable de la qualité des
        prestations réalisées par les Professionnels.
      </p>

      <h2>6. Résiliation et suppression des données</h2>
      <p>
        En cas de résiliation, le Professionnel peut demander l&apos;export puis la suppression
        de ses données à <a href="mailto:contact@matable.pro" className="underline">contact@matable.pro</a>.
      </p>

      <h2>7. Droit applicable</h2>
      <p>Les présentes conditions sont soumises au droit français.</p>
    </>
  );
}
