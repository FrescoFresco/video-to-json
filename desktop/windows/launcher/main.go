// Video Extraction Studio — launcher for Windows.
// First run downloads/installs; later runs start Docker + open the browser.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

const bootstrapCmd = `irm https://raw.githubusercontent.com/FrescoFresco/video-to-json/main/desktop/windows/bootstrap-from-web.ps1 | iex`

func main() {
	fmt.Println("Video Extraction Studio")
	fmt.Println("-----------------------")

	home, err := os.UserHomeDir()
	if err != nil {
		fail("No puedo leer tu carpeta de usuario: " + err.Error())
	}

	installPs1 := filepath.Join(home, "VideoExtractionStudio", "desktop", "windows", "install.ps1")
	var cmd *exec.Cmd

	if fileExists(installPs1) {
		fmt.Println("Abriendo el Studio...")
		cmd = exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", installPs1)
	} else {
		fmt.Println("Primera vez: descargando e instalando (puede tardar)...")
		cmd = exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", bootstrapCmd)
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Run(); err != nil {
		fail("Algo fallo. Lee el mensaje de arriba.")
	}
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
	fmt.Println("  ejecuta Update.bat y luego vuelve a abrir la app.")
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
