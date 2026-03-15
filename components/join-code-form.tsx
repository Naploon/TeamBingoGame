"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input } from "@/components/ui";

export function JoinCodeForm() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = joinCode.trim().toUpperCase();
        if (!normalized) {
          return;
        }
        router.push(`/join/${normalized}`);
      }}
    >
      <Input
        placeholder="Enter join code"
        value={joinCode}
        onChange={(event) => setJoinCode(event.target.value)}
        maxLength={6}
        autoCapitalize="characters"
      />
      <Button type="submit" className="sm:min-w-36">
        Join Event
      </Button>
    </form>
  );
}
