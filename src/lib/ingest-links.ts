/**
 * Tamaño de cada tanda HTTP al subir muchos ítems.
 * No es un límite de cuántos puedes importar: el cliente parte en tandas
 * y todo entra en la cola. Puedes mandar 300, 1000… sin problema.
 */
export const UPLOAD_CHUNK_SIZE = Math.max(
  1,
  Number(process.env.VX_UPLOAD_CHUNK || 50)
);

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;

export function parseLinksFromText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (/^https?:\/\//i.test(trimmed)) {
      const clean = trimmed.replace(/[),.;]+$/g, "");
      if (!seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
      continue;
    }

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
