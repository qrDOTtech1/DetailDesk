"use client";
import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label } from "@/components/ui";

type ActionState = { error?: string; success?: string } | null;
type Field = { name: string; label: string; type?: string; placeholder?: string; required?: boolean };

export function AuthForm({
  title, description, action, fields, submitLabel, footer, hidden,
}: {
  title: string;
  description?: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Field[];
  submitLabel: string;
  footer?: React.ReactNode;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {Object.entries(hidden ?? {}).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            {fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input id={f.name} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} required={f.required ?? true} />
              </div>
            ))}
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
            {state?.success && <p className="text-sm text-emerald-600">{state.success}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "…" : submitLabel}
            </Button>
          </form>
          {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
          <div className="mt-3 text-center">
            <Link href="/" className="text-xs text-muted-foreground hover:underline">← DetailDesk</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
