# Instalación fácil

Dos sistemas, **un comando cada uno**. No hace falta saber de programación.

Al terminar, se abre el navegador en **http://127.0.0.1:43141**

---

## Windows

1. Pulsa la tecla **Windows**, escribe **PowerShell** y ábrelo.
2. Copia **toda** esta línea, pégala y pulsa **Enter**:

```powershell
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex"
```

3. Espera (la primera vez puede tardar varios minutos).
4. Si Windows pide permiso de administrador → **Sí**.
5. Si pide reiniciar (WSL2) → reinicia y **vuelve a pegar el mismo comando**.

**Instalar y actualizar es el mismo comando.** Si lo vuelves a pegar, descarga la última versión, sustituye archivos y arranca de nuevo.

Listo. El programa queda en:

`C:\Users\TU_USUARIO\VideoExtractionStudio`

**Para abrirlo otra vez (sin actualizar):** doble clic en  
`VideoExtractionStudio\desktop\windows\Launch.bat`

**Para actualizar:** pega otra vez el comando de arriba (o doble clic en `Update.bat`).

**Para pararlo:**

```powershell
cd $env:USERPROFILE\VideoExtractionStudio
docker compose down
```

---

## Mac

1. Abre **Terminal** (Spotlight → escribe `Terminal` → Enter).
2. Copia **toda** esta línea, pégala y pulsa **Enter**:

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/FrescoFresco/video-to-json@main/desktop/macos/bootstrap-from-web.sh | bash
```

3. Espera (la primera vez puede tardar).
4. Si pide contraseña de Mac o permiso para instalar Docker → acéptalo.
5. Si Docker pide abrir la app la primera vez → ábrela, acepta, y si el script se paró vuelve a pegar el mismo comando.

Listo. El programa queda en:

`~/VideoExtractionStudio`

**Para abrirlo otra vez:**

```bash
~/VideoExtractionStudio/desktop/macos/install.sh
```

O, si generaste la app:

```bash
~/VideoExtractionStudio/scripts/build-macos-app.sh
# luego doble clic en dist/Video Extraction Studio.app
```

**Para pararlo:**

```bash
cd ~/VideoExtractionStudio
docker compose down
```

---

## Requisitos (mínimo)

| | |
|---|---|
| Sistema | Windows 10/11 o macOS 12+ |
| Memoria | 16 GB recomendado (8 GB va justo) |
| Disco | 15–25 GB libres la primera vez |
| Internet | Sí (descarga Docker/modelos la 1ª vez) |

---

## Si algo falla

| Qué ves | Qué hacer |
|---|---|
| “winget no encontrado” (Windows) | Instala [Docker Desktop](https://www.docker.com/products/docker-desktop/) a mano, ábrelo, y vuelve a pegar el comando |
| “Homebrew no encontrado” (Mac) | Instala Homebrew: https://brew.sh — o Docker Desktop a mano — y vuelve a pegar el comando |
| Docker pide WSL2 / reinicio | Completa ese paso y **repite el mismo comando** |
| El navegador no abre | Entra a mano a http://127.0.0.1:43141 |

---

## ¿Qué hace ese comando?

1. Descarga el Studio en tu usuario.  
2. Instala **Docker Desktop** si no está (la “caja” con todo dentro).  
3. Arranca el Studio.  
4. Abre el navegador.

No tienes que clonar GitHub a mano ni instalar Node/Python.
