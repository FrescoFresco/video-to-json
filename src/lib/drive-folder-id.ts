/** Acepta ID suelto o URL de Drive (`.../folders/ID`). */
export function normalizeDriveFolderId(raw: string): string {
  const s = raw.trim().replace(/^["']+|["']+$/g, "");
  if (!s) return "";
  const fromPath = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromPath?.[1]) return fromPath[1];
  const fromQuery = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (fromQuery?.[1]) return fromQuery[1];
  // Pegaron solo el ID (a veces con ?usp=sharing al final)
  const bare = s.match(/^([a-zA-Z0-9_-]{10,})/);
  if (bare?.[1]) return bare[1];
  return s;
}
