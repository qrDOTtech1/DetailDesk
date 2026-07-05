import { AuthForm } from "../auth-form";
import { updatePassword } from "../actions";

export default function UpdatePasswordPage() {
  return (
    <AuthForm
      title="Nouveau mot de passe"
      action={updatePassword}
      fields={[{ name: "password", label: "Nouveau mot de passe", type: "password" }]}
      submitLabel="Mettre à jour"
    />
  );
}
