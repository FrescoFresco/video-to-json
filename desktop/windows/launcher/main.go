// Video Extraction Studio — launcher for Windows.
// Opens the app and auto-updates from GitHub when a newer version exists.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	bootstrapCmd = `irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex`
	commitsURL   = "https://api.github.com/repos/FrescoFresco/video-to-json/commits/main"
)

func main() {
	fmt.Println("Video Extraction Studio")
	fmt.Println("-----------------------")

	home, err := os.UserHomeDir()
	if err != nil {
		fail("No puedo leer tu carpeta de usuario: " + err.Error())
	}

	installDir := filepath.Join(home, "VideoExtractionStudio")
	installPs1 := filepath.Join(installDir, "desktop", "windows", "install.ps1")
	shaFile := filepath.Join(installDir, "data", ".vx-git-sha")

	var cmd *exec.Cmd

	if !fileExists(installPs1) {
		fmt.Println("Primera vez: descargando e instalando (puede tardar)...")
		cmd = exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", bootstrapCmd)
	} else if needsUpdate(shaFile) {
		fmt.Println("Hay una version nueva. Actualizando solo...")
		cmd = exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", bootstrapCmd)
	} else {
		fmt.Println("Abriendo el Studio...")
		cmd = exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installPs1)
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Run(); err != nil {
		fail("Algo fallo. Lee el mensaje de arriba.")
	}
}

func needsUpdate(shaFile string) bool {
	remote, err := remoteMainSha()
	if err != nil || remote == "" {
		// Offline or API failed: just open what we have.
		return false
	}
	local := ""
	if b, err := os.ReadFile(shaFile); err == nil {
		local = strings.TrimSpace(string(b))
	}
	if local == "" {
		return true
	}
	return local != remote
}

func remoteMainSha() (string, error) {
	client := &http.Client{Timeout: 12 * time.Second}
	req, err := http.NewRequest(http.MethodGet, commitsURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "VideoExtractionStudio")
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("github HTTP %d", res.StatusCode)
	}
	var parsed struct {
		SHA string `json:"sha"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	return parsed.SHA, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func fail(msg string) {
	fmt.Println()
	fmt.Println(msg)
	fmt.Println()
	fmt.Println("Si el error habla de 'public' o 'cache key':")
	fmt.Println("  cierra y vuelve a abrir la app (se actualiza sola).")
	fmt.Println("Si Docker Desktop no arranca el motor:")
	fmt.Println("  abrelo y espera a Engine running.")
	fmt.Println("Solo si Docker pide WSL2 (Admin PowerShell):")
	fmt.Println("  wsl --install --no-distribution")
	fmt.Println("Luego reinicia y vuelve a abrir esta app.")
	fmt.Println()
	fmt.Println("Pulsa Enter para cerrar...")
	_, _ = fmt.Scanln()
	os.Exit(1)
}
