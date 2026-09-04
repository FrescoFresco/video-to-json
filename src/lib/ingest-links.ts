/** Límite alto por petición (cola local; evita petar la RAM de un golpe). */
export const MAX_INGEST_BATCH = Number(process.env.VX_MAX_BATCH || 200);

const URL_IN_TEXT =
  /https?:\/\/[^\s<>"']+/gi;

export function parseLinksFromText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Línea completa si parece URL
    if (/^https?:\/\//i.test(trimmed)) {
      const clean = trimmed.replace(/[),.;]+$/g, "");
      if (!seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
      continue;
    }

    // O URLs embebidas en la línea
    const matches = trimmed.match(URL_IN_TEXT) || [];
    for (const raw of matches) {
      const clean = raw.replace(/[),.;]+$/g, "");
      if (!seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
  }

  return out;
}

export function isLinkListFilename(name: string) {
  return /\.(txt|csv|list)$/i.test(name);
}

export async function readLinksFromFile(file: File): Promise<string[]> {
  const text = await file.text();
  return parseLinksFromText(text);
}
