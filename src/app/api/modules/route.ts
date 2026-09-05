import { NextResponse } from "next/server";
import {
  costConfigFromEnv,
  costSummaryForDuration,
} from "@/lib/pipeline-cost";
import { listExtractionModules } from "@/lib/server/modules";

export const runtime = "nodejs";

/** Lista los módulos registrados + config de coste (para ETA en cliente). */
export async function GET(request: Request) {
  const cfg = costConfigFromEnv();
  const url = new URL(request.url);
  const sampleSec = Number(url.searchParams.get("sampleSec") || 60);
  return NextResponse.json({
    modules: listExtractionModules(),
    cost: cfg,
    sample: costSummaryForDuration(
      Number.isFinite(sampleSec) && sampleSec > 0 ? sampleSec : 60,
      cfg
    ),
  });
}
