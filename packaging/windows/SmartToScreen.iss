#define AppName "SmartToScreen"
#define AppVersion "0.2.0"
#define AppPublisher "SmartToScreen Project"

[Setup]
AppId={{B9CC8CF4-9B97-4721-8B21-7DDFDAD49E8A}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\SmartToScreen
DefaultGroupName=SmartToScreen
OutputDir=dist
OutputBaseFilename=SmartToScreen-Windows-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\SmartToScreen.exe

[Files]
Source: "{#HostDir}\SmartToScreen.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\THIRD-PARTY-NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SunshineInstaller}"; DestDir: "{tmp}"; DestName: "Sunshine-Setup.msi"; Flags: deleteafterinstall

[Icons]
Name: "{group}\SmartToScreen"; Filename: "{app}\SmartToScreen.exe"
Name: "{autodesktop}\SmartToScreen"; Filename: "{app}\SmartToScreen.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"

[Run]
Filename: "msiexec.exe"; Parameters: "/i ""{tmp}\Sunshine-Setup.msi"" /passive"; StatusMsg: "Instalando o motor de transmissão Sunshine…"; Flags: waituntilterminated
Filename: "{app}\SmartToScreen.exe"; Description: "Abrir SmartToScreen"; Flags: postinstall nowait skipifsilent

