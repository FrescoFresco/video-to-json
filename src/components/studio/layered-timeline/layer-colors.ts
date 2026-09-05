/** Paleta estable por índice de capa (sin depender del id del módulo). */
const LAYER_COLORS = [
  "#3d6f99",
  "#177245",
  "#9a6700",
  "#6b5b95",
  "#b42318",
  "#0f766e",
  "#7c3aed",
  "#0369a1",
];

export function layerColor(index: number) {
  return LAYER_COLORS[index % LAYER_COLORS.length];
}
