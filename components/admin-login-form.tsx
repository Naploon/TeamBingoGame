"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button, Input, Panel, SectionHeading } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const checkResponse = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const checkPayload = await checkResponse.json();

      if (!checkResponse.ok) {
        throw new Error(checkPayload.error ?? "This admin account is not enabled.");
      }

      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      window.location.assign("/admin");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel className="mx-auto max-w-lg">
      <SectionHeading
        eyebrow="Admin"
        title="Sign in with email and password"
        description="Only admin accounts entered in the database can open the dashboard."
      />
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Email address</span>
          <Input
            type="email"
            placeholder="organizer@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Password</span>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </Panel>
  );
}
