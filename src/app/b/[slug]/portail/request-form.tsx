"use client";
import * as React from "react";
import Link from "next/link";
import { requestPortalLink } from "./actions";
import { Button, Card, CardContent, Input, Label } from "@/components/ui";

export function PortalRequestForm({ slug }: { slug: string }) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = React.useState("");

  return (
    <Card>
      <CardContent className="pt-5">
        {state === "sent" ? (
          <div className="space-y-2 text-center">
            <p className="text-2xl">📬</p>
            <p className="text-sm">
              Si un compte client existe avec <strong>{email}</strong>, tu vas recevoir un lien de
              connexion (valable 15 minutes). Pense à vérifier tes spams.
            </p>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setState("loading");
              const res = await requestPortalLink(slug, email);
              if ("error" in res && res.error) { setMessage(res.error); setState("error"); }
              else setState("sent");
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Ton email</Label>
              <Input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="celui utilisé pour ta réservation" />
            </div>
            {state === "error" && <p className="text-sm text-destructive">{message}</p>}
            <Button type="submit" className="w-full" disabled={state === "loading"}>
              {state === "loading" ? "…" : "Recevoir mon lien de connexion"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href={`/b/${slug}`} className="underline">← Retour à la réservation</Link>
        </p>
      </CardContent>
    </Card>
  );
}
