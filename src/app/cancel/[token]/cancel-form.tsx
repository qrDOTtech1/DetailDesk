"use client";
import * as React from "react";
import { cancelBookingByToken } from "./actions";
import { Button } from "@/components/ui";

export function CancelForm({ token }: { token: string }) {
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = React.useState("");

  if (state === "done") return <p className="font-medium text-emerald-600">Réservation annulée. ✅</p>;

  return (
    <div className="space-y-2">
      {state === "error" && <p className="text-sm text-destructive">{message}</p>}
      <Button
        variant="destructive" className="w-full" disabled={state === "loading"}
        onClick={async () => {
          setState("loading");
          const res = await cancelBookingByToken(token);
          if ("error" in res && res.error) { setMessage(res.error); setState("error"); }
          else setState("done");
        }}>
        {state === "loading" ? "Annulation…" : "Confirmer l'annulation"}
      </Button>
    </div>
  );
}
