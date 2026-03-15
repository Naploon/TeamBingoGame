import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/game/service";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "Validation failed.",
      },
      { status: 400 },
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: "Unexpected server error.",
    },
    { status: 500 },
  );
}
