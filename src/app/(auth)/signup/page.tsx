import Link from "next/link";
import { AuthForm } from "../auth-form";
import { signUp } from "../actions";

export default function SignupPage() {
  return (
    <AuthForm
      title="Créer mon compte"
      description="Gratuit. Ton lien de réservation en 5 minutes."
      action={signUp}
      fields={[
        { name: "full_name", label: "Nom complet" },
        { name: "email", label: "Email", type: "email" },
        { name: "password", label: "Mot de passe (8+ caractères)", type: "password" },
      ]}
      submitLabel="Créer mon compte"
      footer={<Link href="/login" className="hover:underline">Déjà un compte ? Connexion</Link>}
    />
  );
}
