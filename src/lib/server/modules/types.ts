import type { ExtractionModule, ProbeResult } from "@/lib/types";

export type ModuleContext = {
  videoPath: string;
  filename: string;
  probe: ProbeResult;
  workDir: string;
  /** Resultados de módulos ya ejecutados (para resumen / speakers). */
  previousModules: ExtractionModule[];
};

export type ExtractionModuleDefinition = {
  id: string;
  title: string;
  /** Etapa visible mientras corre este módulo. */
  stage: string;
  run: (ctx: ModuleContext) => Promise<ExtractionModule>;
};
