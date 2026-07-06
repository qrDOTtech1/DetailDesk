export const metadata = { title: "Mentions légales — DetailDesk" };

export default function MentionsLegales() {
  return (
    <>
      <h1>Mentions légales</h1>

      <h2>Éditeur</h2>
      <p>
        Le site et le service DetailDesk sont édités par <strong>Matable.pro</strong>
        {/* TODO à compléter : forme juridique, capital, SIRET, adresse du siège, RCS */}
        . Contact : <a href="mailto:contact@matable.pro" className="underline">contact@matable.pro</a>.
      </p>
      <p>Directeur de la publication : le représentant légal de Matable.pro.</p>

      <h2>Hébergement</h2>
      <p>
        L&apos;application est hébergée par Railway Corporation (railway.com), États-Unis.
        Les emails transactionnels sont acheminés par Resend, les SMS par ClickSend et les
        paiements par Stripe.
      </p>

      <h2>Rôle de DetailDesk</h2>
      <p>
        DetailDesk est un logiciel de réservation mis à disposition de professionnels du
        detailing automobile (les « Professionnels »). Les prestations réservées via une page
        publique DetailDesk sont vendues et réalisées par le Professionnel concerné, seul
        responsable de la prestation. Les acomptes payés en ligne sont encaissés directement
        sur le compte Stripe du Professionnel.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La marque DetailDesk, le logiciel et ses contenus sont la propriété de Matable.pro.
        Les logos de marques automobiles affichés appartiennent à leurs propriétaires
        respectifs et ne sont utilisés qu&apos;à des fins d&apos;identification des véhicules.
      </p>
    </>
  );
}
