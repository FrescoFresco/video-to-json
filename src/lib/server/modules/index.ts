import type { ExtractionModuleDefinition } from "./types";
import { aiReasoningModule } from "./ai-reasoning";
import { audioEventsModule } from "./audio-events";
import { cameraMotionModule } from "./camera-motion";
import { facesFramingModule } from "./faces-framing";
import { musicAmbianceModule } from "./music-ambiance";
import { objectsPeopleModule } from "./objects-people";
import { onScreenTextModule } from "./on-screen-text";
import { poseActionsModule } from "./pose-actions";
import { sceneCutsModule } from "./scene-cuts";
import { speakersModule } from "./speakers";
import { speechModule } from "./speech";
import { summaryModule } from "./summary";
import { visualObservationModule } from "./visual-observation";

/**
 * Registro de módulos activos (orden = orden de ejecución).
 * ai_reasoning va casi al final (necesita hechos previos); summary cierra.
 */
export const EXTRACTION_MODULES: ExtractionModuleDefinition[] = [
  sceneCutsModule,
  cameraMotionModule,
  speechModule,
  speakersModule,
  onScreenTextModule,
  objectsPeopleModule,
  facesFramingModule,
  poseActionsModule,
  visualObservationModule,
  musicAmbianceModule,
  audioEventsModule,
  aiReasoningModule,
  summaryModule,
];

export function listExtractionModules() {
  return EXTRACTION_MODULES.map(({ id, title, stage }) => ({ id, title, stage }));
}
