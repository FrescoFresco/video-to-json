import type { ExtractionModuleDefinition } from "./types";
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
 * Orden = ejecución.
 * Habla → caras → quién habla (cara↔voz) → resto CV/IA → summary.
 */
export const EXTRACTION_MODULES: ExtractionModuleDefinition[] = [
  sceneCutsModule,
  cameraMotionModule,
  speechModule,
  facesFramingModule,
  speakersModule,
  onScreenTextModule,
  objectsPeopleModule,
  poseActionsModule,
  visualObservationModule,
  musicAmbianceModule,
  audioEventsModule,
  summaryModule,
];

export function listExtractionModules() {
  return EXTRACTION_MODULES.map(({ id, title, stage }) => ({ id, title, stage }));
}
