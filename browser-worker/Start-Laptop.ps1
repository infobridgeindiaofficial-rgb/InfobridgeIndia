param([switch]$RegisterLogonTask, [switch]$RegisterOnly, [switch]$KeepAlive, [string]$WslDistribution = 'Ubuntu-24.04')
$ErrorActionPreference = 'Stop'
$workerDirectory = $PSScriptRoot
$dockerCandidates = @(
    "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe",
    "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"
)
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerExecutable = if ($dockerCommand) { $dockerCommand.Source } else {
    $dockerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
# Prefer an already installed Docker CLI; otherwise use the free Docker Engine
# inside WSL. No Docker Desktop subscription or license acceptance is needed.
$useWsl = !$dockerExecutable
if ($useWsl -and !(Get-Command wsl -ErrorAction SilentlyContinue)) { throw 'WSL with Linux Docker Engine is required.' }
function Invoke-LaptopDocker {
    if ($useWsl) { & wsl.exe -d $WslDistribution -u root --exec docker @args }
    else { & $dockerExecutable @args }
    $script:dockerExitCode = $LASTEXITCODE
}
if ($RegisterOnly -and !$RegisterLogonTask) { throw 'RegisterOnly requires RegisterLogonTask.' }
if ($RegisterLogonTask) {
    $taskName = 'InfoBridgeIndia Screen View Laptop'
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        throw 'Screen View logon task already exists; review it before replacing it.'
    }
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -File `"$PSCommandPath`" -KeepAlive -WslDistribution `"$WslDistribution`""
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
    $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
}
if ($RegisterOnly) { return }
foreach ($file in @('.env', '.env.tunnel-token')) {
    if (!(Test-Path -LiteralPath (Join-Path $workerDirectory $file))) { throw "Missing local $file; do not commit credentials." }
}
# Wait for the Linux engine to start after logon. Compose restart policies
# keep all four services running after this script exits; no public port is opened.
$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try { Invoke-LaptopDocker info --format '{{.OSType}}' 2>$null | Out-Null }
    catch { $script:dockerExitCode = 1 }
    if ($dockerExitCode -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 5
}
if (!$ready) { throw 'Linux Docker engine unavailable. Check the WSL docker service or Docker Desktop.' }
$engineType = Invoke-LaptopDocker info --format '{{.OSType}}'
if ($engineType -ne 'linux') { throw 'Linux containers are required to preserve browser isolation.' }
Push-Location -LiteralPath $workerDirectory
try {
    $composeArguments = @('compose', '-f', 'compose.laptop.yaml')
    if ($useWsl) {
        $linuxDirectory = & wsl.exe -d $WslDistribution -u root --exec wslpath -a -u $workerDirectory
        if ($LASTEXITCODE -ne 0 -or !$linuxDirectory) { throw 'Cannot resolve worker directory in WSL.' }
        $composeArguments = @('compose', '--project-directory', $linuxDirectory, '-f', "$linuxDirectory/compose.laptop.yaml")
    }
    Invoke-LaptopDocker @composeArguments config --quiet
    if ($dockerExitCode -ne 0) { throw 'Invalid production configuration.' }
    Invoke-LaptopDocker @composeArguments up --build -d
    if ($dockerExitCode -ne 0) { throw 'Screen View startup failed.' }
} finally { Pop-Location }
if ($KeepAlive -and $useWsl) {
    # Systemd services alone do not keep WSL alive after its last foreground
    # command exits. Keep a foreground WSL process attached for laptop uptime.
    & wsl.exe -d $WslDistribution -u root --exec sleep infinity
    if ($LASTEXITCODE -ne 0) { throw 'WSL keepalive exited; scheduled task will retry.' }
}
