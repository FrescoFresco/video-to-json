"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, FolderOpen, Link2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeDriveFolderId } from "@/lib/drive-folder-id";
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
  driveAuthMethod?: "oauth" | "service_account" | null;
  driveOAuthClientId?: string;
  driveOAuthClientSecretSet?: boolean;
  driveOAuthClientConfigured?: boolean;
  driveOAuthConnected?: boolean;
  driveOAuthEmail?: string | null;
  driveClientEmail?: string | null;
  driveRedirectUri?: string;
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
  const [driveAuthMethod, setDriveAuthMethod] = useState<
    "oauth" | "service_account" | null
  >(null);
  const [driveOAuthClientId, setDriveOAuthClientId] = useState("");
  const [driveOAuthClientSecret, setDriveOAuthClientSecret] = useState("");
  const [driveOAuthClientSecretSet, setDriveOAuthClientSecretSet] = useState(false);
  const [driveOAuthClientConfigured, setDriveOAuthClientConfigured] = useState(false);
  const [driveOAuthConnected, setDriveOAuthConnected] = useState(false);
  const [driveOAuthEmail, setDriveOAuthEmail] = useState<string | null>(null);
  const [driveRedirectUri, setDriveRedirectUri] = useState(
    "http://127.0.0.1:43141/api/drive/oauth/callback"
  );
  const [showAdvancedDrive, setShowAdvancedDrive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driveTestLink, setDriveTestLink] = useState<string | null>(null);
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
    setDriveAuthMethod(data.driveAuthMethod ?? null);
    setDriveOAuthClientId(data.driveOAuthClientId || "");
    setDriveOAuthClientSecretSet(Boolean(data.driveOAuthClientSecretSet));
    setDriveOAuthClientConfigured(Boolean(data.driveOAuthClientConfigured));
    setDriveOAuthConnected(Boolean(data.driveOAuthConnected));
    setDriveOAuthEmail(data.driveOAuthEmail || null);
    setDriveClientEmail(data.driveClientEmail || null);
    if (data.driveRedirectUri) setDriveRedirectUri(data.driveRedirectUri);
    if (data.driveAuthMethod === "service_account") setShowAdvancedDrive(true);
  }

  useEffect(() => {
    // URI de redirección = mismo host con el que abres la app
    try {
      const u = new URL(window.location.href);
      setDriveRedirectUri(
        `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}/api/drive/oauth/callback`
      );
    } catch {
      /* ignore */
    }
  }, []);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("drive_oauth");
    if (!oauth) return;
    setOpenPanel("drive");
    const msg = params.get("drive_oauth_msg") || "";
    if (oauth === "ok") {
      setMessage(msg || "Google conectado. Pega la carpeta y pulsa Probar.");
      setError(null);
    } else {
      setError(msg || "No se pudo conectar con Google.");
      setMessage(null);
    }
    setConnectingGoogle(false);
    params.delete("drive_oauth");
    params.delete("drive_oauth_msg");
    params.delete("view");
    params.delete("panel");
    const next = params.toString();
    window.history.replaceState({}, "", next ? `/?${next}` : "/");
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = (await res.json()) as SettingsPayload;
        if (res.ok) applySettings(data);
      } catch {
        /* ignore */
      }
    })();
  }, []);


  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; ok?: boolean; message?: string } | null;
      if (!data || data.type !== "vx-drive-oauth") return;
      // Aceptamos localhost y 127.0.0.1 del mismo puerto
      try {
        const allowed = new URL(window.location.origin);
        const from = new URL(event.origin);
        const samePort = allowed.port === from.port;
        const local =
          (allowed.hostname === "localhost" || allowed.hostname === "127.0.0.1") &&
          (from.hostname === "localhost" || from.hostname === "127.0.0.1");
        if (!(samePort && (allowed.origin === event.origin || local))) return;
      } catch {
        return;
      }
      if (data.ok) {
        setMessage(data.message || "Google conectado.");
        setError(null);
      } else {
        setError(data.message || "No se pudo conectar con Google.");
        setMessage(null);
      }
      setConnectingGoogle(false);
      setOpenPanel("drive");
      void (async () => {
        try {
          const res = await fetch("/api/settings", { cache: "no-store" });
          const payload = (await res.json()) as SettingsPayload;
          if (res.ok) applySettings(payload);
        } catch {
          /* ignore */
        }
      })();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    setDriveTestLink(null);
    try {
      const folderId = driveFolderId.trim();
      const hasCreds =
        driveOAuthConnected ||
        driveCredentialsSet ||
        Boolean(driveServiceAccountJson.trim());
      // Si rellenó carpeta + auth, activar Drive aunque se le olvidara el checkbox
      const enableDrive =
        driveEnabled || (Boolean(folderId) && hasCreds);

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
          inboxEnabled,
          inboxPath,
          outboxPath,
          driveEnabled: enableDrive,
          driveFolderId: folderId,
          driveOAuthClientId: driveOAuthClientId.trim(),
          ...(driveOAuthClientSecret.trim()
            ? { driveOAuthClientSecret: driveOAuthClientSecret.trim() }
            : {}),
          ...(driveServiceAccountJson.trim()
            ? { driveServiceAccountJson: driveServiceAccountJson.trim() }
            : {}),
        }),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      applySettings(data);
      setDriveEnabled(Boolean(data.driveEnabled));
      setWebhookSecret("");
      setDriveOAuthClientSecret("");
      setDriveServiceAccountJson("");
      setMessage(
        enableDrive && folderId && hasCreds
          ? "Guardado. Ya puedes pulsar Probar para comprobar Drive."
          : "Conexión guardada."
      );
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
      setDriveOAuthConnected(false);
      setDriveOAuthEmail(null);
      setDriveAuthMethod(null);
      setMessage("Conexión de Google Drive eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la clave de Drive");
    } finally {
      setSaving(false);
    }
  }

  
  async function connectGoogle() {
    setError(null);
    setMessage(null);
    setConnectingGoogle(true);
    // Abrir el popup YA (gesto del usuario). Si lo abrimos después del await,
    // el navegador lo bloquea y parece que el botón no hace nada.
    const popup = window.open(
      "about:blank",
      "vx-google-oauth",
      "width=520,height=700,menubar=no,toolbar=no,status=no"
    );
    try {
      if (!driveOAuthClientConfigured) {
        if (!driveOAuthClientId.trim() || (!driveOAuthClientSecret.trim() && !driveOAuthClientSecretSet)) {
          if (popup && !popup.closed) popup.close();
          throw new Error(
            "Primero pega Client ID y Client Secret (setup una vez), luego pulsa Conectar con Google."
          );
        }
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driveOAuthClientId: driveOAuthClientId.trim(),
            ...(driveOAuthClientSecret.trim()
              ? { driveOAuthClientSecret: driveOAuthClientSecret.trim() }
              : {}),
            driveFolderId: driveFolderId.trim(),
            driveEnabled: true,
          }),
        });
        const data = (await res.json()) as SettingsPayload;
        if (!res.ok) throw new Error(data.error || "No se pudo guardar Client ID/Secret");
        applySettings(data);
        setDriveOAuthClientSecret("");
        if (!data.driveOAuthClientConfigured) {
          if (popup && !popup.closed) popup.close();
          throw new Error(
            "Faltan Client ID / Secret. Pégalos arriba y vuelve a pulsar Conectar."
          );
        }
      }

      const startUrl = "/api/drive/oauth/start";
      if (!popup || popup.closed) {
        window.location.href = startUrl;
        return;
      }
      popup.location.href = startUrl;
      setMessage("Completa el login de Google en la ventana emergente…");
      // Si el popup muere al momento (bloqueador), ir en la misma pestaña
      window.setTimeout(() => {
        try {
          if (popup.closed) {
            setConnectingGoogle(false);
            setError(
              "El navegador bloqueó la ventana de Google. Permite popups o se abrirá en esta pestaña."
            );
            window.location.href = startUrl;
          }
        } catch {
          /* ignore */
        }
      }, 800);
    } catch (err) {
      setConnectingGoogle(false);
      if (popup && !popup.closed) {
        try {
          popup.close();
        } catch {
          /* ignore */
        }
      }
      setError(err instanceof Error ? err.message : "No se pudo iniciar el login de Google");
    }
  }

  async function disconnectGoogle() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearDriveOAuth: true }),
      });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) throw new Error(data.error || "No se pudo desconectar Google");
      applySettings(data);
      setMessage("Sesión de Google desconectada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desconectar Google");
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
    setDriveTestLink(null);
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
        cleanedUp?: boolean;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo subir a Drive");
      if (data.cleanedUp) {
        setMessage(
          "Conexión correcta: subí un archivo de prueba a tu carpeta de Drive y lo borré. Todo OK."
        );
      } else {
        setMessage(
          "Conexión correcta: el archivo de prueba llegó a tu carpeta. Puedes abrirlo y borrarlo tú."
        );
        if (data.webViewLink) setDriveTestLink(data.webViewLink);
      }
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

      {(message || error || driveTestLink) && !openPanel && (
        <div className="min-w-0 rounded-xl border border-[#e7e7eb] bg-white px-4 py-3">
          {message ? <p className="text-sm text-[#177245]">{message}</p> : null}
          {driveTestLink ? (
            <a
              href={driveTestLink}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm font-medium text-[#171719] underline underline-offset-2"
            >
              Abrir archivo de prueba en Drive
            </a>
          ) : null}
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
          message={message}
          error={error}
          messageLink={
            driveTestLink
              ? { href: driveTestLink, label: "Abrir archivo de prueba en Drive" }
              : null
          }
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
              <p className="mb-4 text-[12.5px] leading-relaxed text-[#5c5c66]">
                Pulsa <strong>Conectar con Google</strong>, inicia sesión con tu Gmail y
                autoriza el acceso. Luego pega la URL de tu carpeta y pulsa{" "}
                <strong>Probar</strong>.
              </p>
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

                {!driveOAuthClientConfigured ? (
                  <div className="grid min-w-0 gap-3 rounded-xl border border-dashed border-[#d7d7dc] bg-[#fafafa] p-3">
                    <p className="text-[12px] leading-relaxed text-[#5c5c66]">
                      Setup una sola vez (dueño de la app): crea un cliente OAuth en Google
                      Cloud (tipo Aplicación web), activa Drive API y pega aquí Client ID y
                      Secret. URI de redirección:
                      <code className="mt-1 block break-all rounded-lg bg-white px-2 py-1 text-[11px]">
                        {driveRedirectUri}
                      </code>
                    </p>
                    <label className="grid min-w-0 gap-1.5 text-sm">
                      <span className="text-[#75757d]">Client ID</span>
                      <input
                        value={driveOAuthClientId}
                        onChange={(e) => setDriveOAuthClientId(e.target.value)}
                        placeholder="xxxxxx.apps.googleusercontent.com"
                        className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-white px-3 font-mono text-[13px] outline-none focus:border-[#9e9ea5]"
                      />
                    </label>
                    <label className="grid min-w-0 gap-1.5 text-sm">
                      <span className="text-[#75757d]">
                        Client Secret {driveOAuthClientSecretSet ? "(guardado)" : ""}
                      </span>
                      <input
                        type="password"
                        value={driveOAuthClientSecret}
                        onChange={(e) => setDriveOAuthClientSecret(e.target.value)}
                        placeholder={
                          driveOAuthClientSecretSet
                            ? "Vacío = no cambiar"
                            : "GOCSPX-…"
                        }
                        className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-white px-3 font-mono text-[13px] outline-none focus:border-[#9e9ea5]"
                      />
                    </label>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {driveOAuthConnected ? (
                    <>
                      <span className="text-sm text-[#1a7f37]">
                        Conectado
                        {driveOAuthEmail ? ` · ${driveOAuthEmail}` : ""}
                      </span>
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        disabled={saving}
                        onClick={() => void disconnectGoogle()}
                      >
                        Desconectar Google
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="rounded-xl"
                      disabled={saving || connectingGoogle}
                      onClick={() => void connectGoogle()}
                    >
                      {connectingGoogle ? "Abriendo Google…" : "Conectar con Google"}
                    </Button>
                  )}
                </div>

                <label className="grid min-w-0 gap-1.5 text-sm">
                  <span className="text-[#75757d]">ID o URL de la carpeta</span>
                  <input
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    onBlur={() =>
                      setDriveFolderId((v) => normalizeDriveFolderId(v))
                    }
                    placeholder="https://drive.google.com/drive/folders/… o solo el ID"
                    className="h-10 w-full min-w-0 rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 font-mono text-[13px] outline-none focus:border-[#9e9ea5]"
                  />
                </label>

                <button
                  type="button"
                  className="justify-self-start text-left text-[12.5px] text-[#75757d] underline"
                  onClick={() => setShowAdvancedDrive((v) => !v)}
                >
                  {showAdvancedDrive
                    ? "Ocultar modo avanzado"
                    : "Modo avanzado: cuenta de servicio / Unidad compartida"}
                </button>
                {showAdvancedDrive ? (
                  <label className="grid min-w-0 gap-1.5 text-sm">
                    <span className="text-[#75757d]">
                      JSON cuenta de servicio{" "}
                      {driveAuthMethod === "service_account" && driveClientEmail
                        ? `(activa: ${driveClientEmail})`
                        : driveCredentialsSet && driveAuthMethod !== "oauth"
                          ? "(guardada)"
                          : ""}
                    </span>
                    <textarea
                      value={driveServiceAccountJson}
                      onChange={(e) => setDriveServiceAccountJson(e.target.value)}
                      rows={4}
                      placeholder={
                        driveCredentialsSet && driveAuthMethod === "service_account"
                          ? "Vacío = no cambiar la clave guardada"
                          : '{ "type": "service_account", "client_email": "...", ... }'
                      }
                      className="w-full min-w-0 resize-y rounded-xl border border-[#d7d7dc] bg-[#fbfbfc] px-3 py-2 font-mono text-[12px] outline-none focus:border-[#9e9ea5]"
                    />
                    <span className="text-[11.5px] text-[#8a8a93]">
                      Solo Workspace con Unidades compartidas. En Gmail usa Conectar con
                      Google.
                    </span>
                  </label>
                ) : null}
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
