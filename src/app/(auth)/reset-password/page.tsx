import Link from "next/link";
import { AuthForm } from "../auth-form";
import { resetPassword } from "../actions";

export default function ResetPasswordPage() {
  return (
    <AuthForm
      title="Mot de passe oublié"
      description="On t'envoie un lien de réinitialisation."
      action={resetPassword}
      fields={[{ name: "email", label: "Email", type: "email" }]}
      submitLabel="Envoyer le lien"
      footer={<Link href="/login" className="hover:underline">Retour à la connexion</Link>}
    />
  );
}
