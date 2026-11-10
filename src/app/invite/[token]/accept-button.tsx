"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button className="w-full" loading={pending} onClick={() => start(async () => { const r = await acceptInvite(token); if (r && !r.ok) setError(r.error); })}>Accept invitation</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </>
  );
}
