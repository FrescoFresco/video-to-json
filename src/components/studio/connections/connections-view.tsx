"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, FolderOpen, Link2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionCard } from "./connection-card";
import { ConnectionConfigModal } from "./connection-config-modal";

type SettingsPayload = {
  webhookUrl?: string;
  webhookSecretSet?: boolean;
  inboxEnabled?: boolean;
  inboxPath?: string;
  outboxPath?: string;
  driveEnabled?: boolean;
  driveFolderId?: string;
  driveCredentialsSet?: boolean;
  driveClientEmail?: string | null;
  error?: string;
};

type PanelId = "drive" | "webhook" | "folder";

export function ConnectionsView() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [secretSet, setSecretSet] = useState(false);
  const [inboxEnabled, setInboxEnabled] = useState(false);
  const [inboxPath, setInboxPath] = useState("");
  const [outboxPath, setOutboxPath] = useState("");
  const [driveEnabled, setDriveEnabled] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [driveServiceAccountJson, setDriveServiceAccountJson] = useState("");
  const [driveCredentialsSet, setDriveCredentialsSet] = useState(false);
  const [driveClientEmail, setDriveClientEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);

  const closePanel = useCallback(() => setOpenPanel(null), []);

  function applySettings(data: SettingsPayload) {
    setWebhookUrl(data.webhookUrl || "");
    setSecretSet(Boolean(data.webhookSecretSet));
    setInboxEnabled(Boolean(data.inboxEnabled));
    setInboxPath(data.inboxPath || "");
    setOutboxPath(data.outboxPath || "");
    setDriveEnabled(Boolean(data.driveEnabled));
    setDriveFolderId(data.driveFolderId || "");
    setDriveCredentialsSet(Boolean(data.driveCredentialsSet));
    setDriveClientEmail(data.driveClientEmail || null);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = (await res.json()) as SettingsPayload;
        if (!res.ok) throw new Error(data.error || "No se pudo cargar conexiones");
        if (cancelled) return;
        applySettings(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar conexiones");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
          inboxEnabled,
          inboxPath,
          outboxPath,
          driveEnabled,
          driveFolderId,
          ...(driveServiceAccountJson.trim()
            ? { driveServiceAccountJson: driveServiceAccountJson.trim() }
            : {}),
        }),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      applySettings(data);
      setWebhookSecret("");
      setDriveServiceAccountJson("");
      setMessage("Conexión guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function clearSecret() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearWebhookSecret: true }),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) throw new Error(data.error || "No se pudo quitar el secreto");
      setSecretSet(Boolean(data.webhookSecretSet));
      setWebhookSecret("");
      setMessage("Secreto del webhook eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el secreto");
    } finally {
      setSaving(false);
    }
  }

  async function clearDriveCredentials() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearDriveCredentials: true }),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) throw new Error(data.error || "No se pudo quitar la clave de Drive");
      setDriveCredentialsSet(Boolean(data.driveCredentialsSet));
      setDriveClientEmail(data.driveClientEmail || null);
      setDriveServiceAccountJson("");
      setMessage("Clave de Google Drive eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la clave de Drive");
    } finally {
      setSaving(false);
    }
  }

  async function testWebhook() {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; status?: number };
      if (!res.ok || !data.ok) throw new Error(data.error || "La prueba falló");
      setMessage(`Webhook OK (HTTP ${data.status ?? 200}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La prueba falló");
    } finally {
      setTesting(false);
    }
  }

  async function testDrive() {
    setTestingDrive(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_drive" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        webViewLink?: string;
        name?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo subir a Drive");
      setMessage(
        data.webViewLink
          ? `Drive OK. Archivo de prueba: ${data.webViewLink}`
          : `Drive OK. Subido: ${data.name || "prueba"}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo probar Drive");
    } finally {
      setTestingDrive(false);
    }
  }

  const driveConnected = driveEnabled && Boolean(driveFolderId) && driveCredentialsSet;
  const webhookConnected = Boolean(webhookUrl.trim());
  const folderConnected = inboxEnabled && Boolean(inboxPath.trim());

  const modalMeta =
    openPanel === "drive"
      ? {
          title: "Google Drive",
          statusOk: driveConnected,
          statusLabel: driveConnected ? "Conectado" : "Sin configurar",
          icon: <Cloud className="size-[18px]" />,
        }
      : openPanel === "webhook"
        ? {
            title: "Webhook",
            statusOk: webhookConnected,
            statusLabel: webhookConnected ? "Conectado" : "Sin configurar",
            icon: <Link2 className="size-[18px]" />,
          }
        : openPanel === "folder"
          ? {
              title: "Carpeta local",
              statusOk: folderConnected,
              statusLabel: folderConnected ? "Activa" : "Apagada",
              icon: <FolderOpen className="size-[18px]" />,
            }
          : null;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="min-w-0">
        <div className="mb-1 inline-flex items-center gap-2 text-[#75757d]">
          <Plug className="size-4" />
          <span className="text-[12.5px] font-medium uppercase tracking-[0.04em]">Hub</span>
        </div>
        <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold tracking-[-0.035em]">
          Conexiones
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-[#75757d]">
          Aquí enlazas dónde se guardan o envían los JSON al terminar cada vídeo.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#75757d]">Cargando conexiones…</p>
      ) : (
        <div className="grid min-w-0 items-start gap-3 md:grid-cols-2">
          <ConnectionCard
            icon={<Cloud className="size-[18px]" />}
            title="Google Drive"
            statusOk={driveConnected}
            statusLabel={driveConnected ? "Conectado" : "Sin configurar"}
            summary={
              driveConnected
                ? `Carpeta ${driveFolderId.slice(0, 12)}… · subida automática`
                : "Sube cada JSON a una carpeta en la nube"
            }
            actionLabel={driveConnected ? "Editar" : "Configurar"}
            onOpen={() => setOpenPanel("drive")}
          />

          <ConnectionCard
            icon={<Link2 className="size-[18px]" />}
            title="Webhook"
            statusOk={webhookConnected}
            statusLabel={webhookConnected ? "Conectado" : "Sin configurar"}
            summary={
              webhookConnected
                ? webhookUrl.replace(/^https?:\/\//, "").slice(0, 42)
                : "Make, n8n, Zapier o tu backend"
            }
            actionLabel={webhookConnected ? "Editar" : "Configurar"}
            onOpen={() => setOpenPanel("webhook")}
          />

          <ConnectionCard
            icon={<FolderOpen className="size-[18px]" />}
            title="Carpeta local"
            statusOk={folderConnected}
            statusLabel={folderConnected ? "Activa" : "Apagada"}
            summary={
              folderConnected
                ? `Vigila ${inboxPath.split(/[/\\]/).filter(Boolean).slice(-1)[0] || "entrada"}`
                : "Opcional · útil con Drive Desktop"
            }
            actionLabel={folderConnected ? "Editar" : "Configurar"}
            onOpen={() => setOpenPanel("folder")}
          />

          <section className="min-w-0 self-start overflow-hidden rounded-2xl border border-dashed border-[#d7d7dc] bg-[#fbfbfc] p-4 sm:p-5">
            <div className="grid size-10 place-items-center rounded-xl bg-white text-[#9e9ea5]">
              <Plug className="size-[18px]" />
            </div>
            <h2 className="mt-3 text-sm font-semibold tracking-[-0.02em]">Más adelante</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#75757d]">
              Dropbox, Notion u otros destinos podrán enchufarse aquí como otra tarjeta.
            </p>
            <p className="mt-4 text-[12px] text-[#9e9ea5]">Próximamente</p>
          </section>
        </div>
      )}

      {(message || error) && (
        <div className="min-w-0 rounded-xl border border-[#e7e7eb] bg-white px-4 py-3">
          {message ? <p className="text-sm text-[#177245]">{message}</p> : null}
          {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
        </div>
      )}

      {modalMeta ? (
        <ConnectionConfigModal
          open
          title={modalMeta.title}
          statusOk={modalMeta.statusOk}
          statusLabel={modalMeta.statusLabel}
          icon={modalMeta.icon}
          onClose={closePanel}
          footer={
            openPanel === "drive" ? (
              <div className="flex flex-wrap gap-2">
                <Button className="rounded-xl" disabled={saving} onClick={() => void save()}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={testingDrive || saving}
                  onClick={() => void testDrive()}
                >
                  {testingDrive ? "Probando…" : "Probar"}
                </Button>
                {driveCredentialsSet ? (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={saving}
                    onClick={() => void clearDriveCredentials()}
                  >
                    Quitar clave
                  </Button>
                ) : null}
              </div>
            ) : openPanel === "webhook" ? (
              <div className="flex flex-wrap gap-2">
                <Button className="rounded-xl" disabled={saving} onClick={() => void save()}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={testing || !webhookUrl.trim()}
                  onClick={() => void testWebhook()}
                >
                  {testing ? "Probando…" : "Probar"}
                </Button>
                {secretSet ? (
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={saving}
                    onClick={() => void clearSecret()}
                  >
                    Quitar secreto
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button className="rounded-xl" disabled={saving} onClick={() => void save()}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            )
          }
        >
          {openPanel === "drive" ? (
            <>
              <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-[#5c5c66]">
                <li>
                  Google Cloud → activa Drive API → cuenta de servicio → descarga el JSON.
                </li>
                <li>
                  En Drive, carpeta → copia el ID de <code>…/folders/ID</code> y compártela con
                  el email <code>@…gserviceaccount.com</code> (editor).
                </li>
              </ol>
              <div className="grid min-w-0 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={driveEnabled}
                    onChange={(e) => setDriveEnabled(e.target.checked)}
                    className="size-4 rounded border-[#d7d7dc]"
                  />
                  <span>Subir automáticamente cada JSON</span>
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm">
                  <span className="text-[#75757d]">ID de la carpeta</span>
                  <input
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    placeholder="1AbCDefGhijKLmnopQRsTUVwxyz"
                    className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 font-mono text-[13px] outline-none focus:border-[#9e9ea5]"
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm">
                  <span className="text-[#75757d]">
                    JSON cuenta de servicio{" "}
                    {driveCredentialsSet
                      ? `(guardada${driveClientEmail ? `: ${driveClientEmail}` : ""})`
                      : ""}
                  </span>
                  <textarea
                    value={driveServiceAccountJson}
                    onChange={(e) => setDriveServiceAccountJson(e.target.value)}
                    rows={4}
                    placeholder={
                      driveCredentialsSet
                        ? "Vacío = no cambiar la clave guardada"
                        : '{ "type": "service_account", ... }'
                    }
                    className="w-full min-w-0 resize-y rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 py-2 font-mono text-[12px] outline-none focus:border-[#9e9ea5]"
                  />
                </label>
              </div>
            </>
          ) : null}

          {openPanel === "webhook" ? (
            <div className="grid min-w-0 gap-3">
              <label className="grid min-w-0 gap-1.5 text-sm">
                <span className="text-[#75757d]">URL del webhook</span>
                <input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.ejemplo.com/vx"
                  className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
                />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm">
                <span className="text-[#75757d]">
                  Secreto opcional {secretSet ? "(ya hay uno)" : ""}
                </span>
                <input
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={secretSet ? "Vacío = no cambiar" : "Bearer token o clave"}
                  className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
                />
              </label>
            </div>
          ) : null}

          {openPanel === "folder" ? (
            <div className="grid min-w-0 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inboxEnabled}
                  onChange={(e) => setInboxEnabled(e.target.checked)}
                  className="size-4 rounded border-[#d7d7dc]"
                />
                <span>Activar vigilancia de carpeta</span>
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm">
                <span className="text-[#75757d]">Entrada (vídeos)</span>
                <input
                  value={inboxPath}
                  onChange={(e) => setInboxPath(e.target.value)}
                  placeholder="/Users/tú/Google Drive/VX-entrada"
                  className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
                />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm">
                <span className="text-[#75757d]">Salida (JSON)</span>
                <input
                  value={outboxPath}
                  onChange={(e) => setOutboxPath(e.target.value)}
                  placeholder="/Users/tú/Google Drive/VX-salida"
                  className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 outline-none focus:border-[#9e9ea5]"
                />
              </label>
            </div>
          ) : null}
        </ConnectionConfigModal>
      ) : null}
    </div>
  );
}
