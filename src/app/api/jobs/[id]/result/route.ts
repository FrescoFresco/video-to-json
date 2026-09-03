import { NextResponse } from "next/server";
import { getJobResult } from "@/lib/server/job-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = getJobResult(id);
  if (!result) {
    return NextResponse.json({ error: "Resultado no disponible" }, { status: 404 });
  }
  return NextResponse.json(result);
}
