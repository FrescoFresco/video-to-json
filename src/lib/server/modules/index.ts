import type { ExtractionModuleDefinition } from "./types";
import { onScreenTextModule } from "./on-screen-text";
import { sceneCutsModule } from "./scene-cuts";
import { speechModule } from "./speech";
import { visualObservationModule } from "./visual-observation";

/**
 * Registro de módulos activos.
 * Para enchufar otro repo: añade aquí una definición con el mismo contrato
 * (id, title, stage, run) y la UI / el JSON lo recogerán solos.
 */
export const EXTRACTION_MODULES: ExtractionModuleDefinition[] = [
  sceneCutsModule,
  speechModule,
  onScreenTextModule,
  visualObservationModule,
];

export function listExtractionModules() {
  return EXTRACTION_MODULES.map(({ id, title, stage }) => ({ id, title, stage }));
}
