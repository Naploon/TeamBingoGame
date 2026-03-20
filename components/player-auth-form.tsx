"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button, Input } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign_in" | "sign_up";

export function PlayerAuthForm({
  joinCode,
  registrationOpen,
}: {
  joinCode: string;
  registrationOpen: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "sign_in") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          throw authError;
        }

        window.location.assign(`/join/${joinCode}`);
        return;
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const response = await fetch(`/api/join/${joinCode}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create your account.");
      }

      setMode("sign_in");
      setConfirmPassword("");
      setMessage(
        payload.message ??
          "Your account is ready. No email confirmation dance right now, so you can sign in straight away.",
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {registrationOpen ? (
        <div className="inline-flex rounded-full bg-ink/5 p-1">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "sign_in" ? "bg-ink text-white" : "text-ink/60"
            }`}
            onClick={() => {
              setMode("sign_in");
              setConfirmPassword("");
              setMessage(null);
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === "sign_up" ? "bg-ink text-white" : "text-ink/60"
            }`}
            onClick={() => {
              setMode("sign_up");
              setConfirmPassword("");
              setMessage(null);
              setError(null);
            }}
          >
            Create account
          </button>
        </div>
      ) : null}
      <p className="text-sm leading-6 text-ink/65">
        Use the same email each time so the app can find your team, your progress, and your place in the game like an old friend.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Email address</span>
          <Input
            type="email"
            autoComplete="email"
            placeholder="player@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Password</span>
          <Input
            type="password"
            autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {mode === "sign_up" ? (
          <label className="block space-y-2 text-sm font-medium text-ink">
            <span>Confirm password</span>
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Type the same password again"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
        ) : null}
        {message ? <p className="text-sm text-sea">{message}</p> : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "sign_in"
              ? "Signing in..."
              : "Creating account..."
            : mode === "sign_in"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>
    </div>
  );
}
