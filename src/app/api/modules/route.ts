import { NextResponse } from "next/server";
import { listExtractionModules } from "@/lib/server/modules";

export const runtime = "nodejs";

/** Lista los módulos registrados (para UIs / integraciones). */
export async function GET() {
  return NextResponse.json({ modules: listExtractionModules() });
}
