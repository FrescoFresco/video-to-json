; Inno Setup script — build on Windows (CI or local with Inno Setup 6).
; Produces: dist/VideoExtractionStudio-Setup.exe
;
; Requires: VideoExtractionStudio.exe next to this file (built by build.ps1).

#define MyAppName "Video Extraction Studio"
#define MyAppVersion "0.1.1"
#define MyAppPublisher "FrescoFresco"
#define MyAppURL "https://github.com/FrescoFresco/video-to-json"
#define MyAppExe "VideoExtractionStudio.exe"

[Setup]
AppId={{8F3C2A91-6B4E-4D2F-9C1A-7E5B0A1D2C3F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={localappdata}\VideoExtractionStudioLauncher
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\..\dist\windows
OutputBaseFilename=VideoExtractionStudio-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=
UninstallDisplayIcon={app}\{#MyAppExe}
InfoBeforeFile=README-INSTALL.txt

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear icono en el escritorio"; GroupDescription: "Accesos directos:"; Flags: checkedonce

[Files]
Source: "VideoExtractionStudio.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExe}"; Description: "Abrir Video Extraction Studio ahora"; Flags: nowait postinstall skipifsilent
