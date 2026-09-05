# Windows desktop wrapper

## What you get

1. **VideoExtractionStudio-Setup.exe** — normal installer (Next → Finish)
2. Desktop shortcut **Video Extraction Studio**
3. First open downloads/starts the Studio (Docker). Later opens it again.

## Build

### Launcher only (Linux/macOS/Windows with Go)

```bash
./desktop/windows/installer/build-launcher.sh
```

### Full installer (Windows + [Inno Setup 6](https://jrsoftware.org/isinfo.php))

```powershell
powershell -ExecutionPolicy Bypass -File .\desktop\windows\installer\build.ps1
```

Or GitHub Actions → **Windows installer** (also on tag `v*`).

## Lines of code (approx.)

| Piece | Path | ~LOC |
|---|---|---|
| Launcher | `launcher/main.go` | ~60 |
| Inno script | `installer/setup.iss` | ~55 |
| Build scripts | `build.ps1` + `build-launcher.sh` | ~50 |
| CI | `.github/workflows/windows-installer.yml` | ~45 |
