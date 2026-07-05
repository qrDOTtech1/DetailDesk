import { AuthForm } from "../../auth-form";
import { updatePasswordWithToken } from "../../actions";

export default async function ResetPasswordTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthForm
      title="Choisis un nouveau mot de passe"
      action={updatePasswordWithToken}
      hidden={{ token }}
      fields={[{ name: "password", label: "Nouveau mot de passe", type: "password" }]}
      submitLabel="Mettre à jour"
    />
  );
}
