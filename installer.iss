; Inno Setup Script for NodeHotkey v3.0.0
; Free Inno Setup Compiler available at: https://jrsoftware.org/isdl.php

#define MyAppName "NodeHotkey"
#define MyAppVersion "3.0.0"
#define MyAppPublisher "NodeHotkey Team"
#define MyAppURL "https://github.com/WADADADANG/NodeHotkey"
#define MyAppExeName "NodeHotkey.bat"

[Setup]
; App Metadata
AppId={{C8E2B9A1-7D4F-4C2E-9F3A-8E6B1D5F4A22}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Destination Directories ({localappdata} requires no Admin UAC permission)
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output Configuration
OutputDir=dist
OutputBaseFilename=NodeHotkey-Setup-v{#MyAppVersion}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico

; Compression (Ultra LZMA2 for super small installer size)
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

; Visual Styling
PrivilegesRequired=lowest
DisableWelcomePage=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "silenticon"; Description: "Create Silent/Background Mode Desktop Shortcut"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Package all prepared files from dist/NodeHotkey
Source: "dist\NodeHotkey\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu Shortcuts
Name: "{group}\{#MyAppName}"; Filename: "{app}\node_modules\electron\dist\electron.exe"; Parameters: """{app}\launcher\main.js"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Comment: "Open NodeHotkey Control Center"
Name: "{group}\{#MyAppName} (Silent Mode)"; Filename: "{app}\NodeHotkey-Silent.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Comment: "Run NodeHotkey in Background"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; Desktop Shortcuts (Optional)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\node_modules\electron\dist\electron.exe"; Parameters: """{app}\launcher\main.js"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon
Name: "{autodesktop}\{#MyAppName} (Silent)"; Filename: "{app}\NodeHotkey-Silent.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"; Tasks: silenticon

[Run]
; Option to launch app immediately after installation
Filename: "{app}\node_modules\electron\dist\electron.exe"; Parameters: """{app}\launcher\main.js"""; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: postinstall nowait skipifsilent
