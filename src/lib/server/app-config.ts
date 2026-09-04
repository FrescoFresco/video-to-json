import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AppConfig = {
  webhookUrl: string;
  /** Cabecera opcional Authorization (ej. Bearer xxx). */
  webhookSecret: string;
};

const DEFAULT_CONFIG: AppConfig = {
  webhookUrl: "",
  webhookSecret: "",
};

function configPath() {
  const root = process.env.VX_DATA_DIR
    ? path.dirname(process.env.VX_DATA_DIR)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
  return path.join(/*turbopackIgnore: true*/ root, "config.json");
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      webhookUrl: typeof parsed.webhookUrl === "string" ? parsed.webhookUrl.trim() : "",
      webhookSecret:
        typeof parsed.webhookSecret === "string" ? parsed.webhookSecret.trim() : "",
    };
  } catch {
    const fromEnv = (process.env.WEBHOOK_URL || "").trim();
    return {
      ...DEFAULT_CONFIG,
      webhookUrl: fromEnv,
      webhookSecret: (process.env.WEBHOOK_SECRET || "").trim(),
    };
  }
}

export async function writeAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readAppConfig();
  const next: AppConfig = {
    webhookUrl:
      typeof patch.webhookUrl === "string" ? patch.webhookUrl.trim() : current.webhookUrl,
    webhookSecret:
      typeof patch.webhookSecret === "string"
        ? patch.webhookSecret.trim()
        : current.webhookSecret,
  };
  const file = configPath();
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(
    /*turbopackIgnore: true*/ file,
    JSON.stringify(next, null, 2),
    "utf8"
  );
  return next;
}
