import type { ExtractionModuleDefinition } from "./types";
import { musicAmbianceModule } from "./music-ambiance";
import { objectsPeopleModule } from "./objects-people";
import { onScreenTextModule } from "./on-screen-text";
import { sceneCutsModule } from "./scene-cuts";
import { speakersModule } from "./speakers";
import { speechModule } from "./speech";
import { summaryModule } from "./summary";
import { visualObservationModule } from "./visual-observation";

/**
 * Registro de módulos activos (orden = orden de ejecución).
 * summary va al final porque lee previousModules.
 */
export const EXTRACTION_MODULES: ExtractionModuleDefinition[] = [
  sceneCutsModule,
  speechModule,
  speakersModule,
  onScreenTextModule,
  objectsPeopleModule,
  visualObservationModule,
  musicAmbianceModule,
  summaryModule,
];

export function listExtractionModules() {
  return EXTRACTION_MODULES.map(({ id, title, stage }) => ({ id, title, stage }));
}
