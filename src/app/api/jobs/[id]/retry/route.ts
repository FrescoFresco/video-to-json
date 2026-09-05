import { NextResponse } from "next/server";
import { JobRetryError, retryJob } from "@/lib/server/job-store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const job = await retryJob(id);
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    if (error instanceof JobRetryError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "busy"
            ? 409
            : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }
    const message =
      error instanceof Error ? error.message : "No se pudo reintentar el trabajo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
