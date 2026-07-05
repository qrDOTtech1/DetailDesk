import Link from "next/link";
import { AuthForm } from "../auth-form";
import { signIn } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthForm
      title="Connexion"
      description="Accède à ton espace DetailDesk."
      action={signIn}
      hidden={{ next: next ?? "/dashboard" }}
      fields={[
        { name: "email", label: "Email", type: "email" },
        { name: "password", label: "Mot de passe", type: "password" },
      ]}
      submitLabel="Se connecter"
      footer={
        <>
          <Link href="/reset-password" className="hover:underline">Mot de passe oublié ?</Link>
          {" · "}
          <Link href="/signup" className="hover:underline">Créer un compte</Link>
        </>
      }
    />
  );
}
