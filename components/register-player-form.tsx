"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button, Input } from "@/components/ui";

export function RegisterPlayerForm({
  joinCode,
  disabled,
}: {
  joinCode: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/join/${joinCode}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not register.");
      }

      router.push(payload.redirectTo);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <label className="block space-y-2 text-sm font-medium text-ink">
        <span>Display name</span>
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="How should the teams know you?"
          required
          disabled={disabled}
        />
      </label>
      {error ? <p className="text-sm text-coral">{error}</p> : null}
      <Button type="submit" disabled={disabled || isSubmitting}>
        {isSubmitting ? "Saving..." : "Register and continue"}
      </Button>
    </form>
  );
}
