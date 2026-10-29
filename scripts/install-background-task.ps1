param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if ($projectRoot -notmatch '^D:\\') { throw 'Task data must physically reside on D:' }
Set-Location -LiteralPath $projectRoot
$directory = Join-Path $projectRoot '.local/services/task-runner'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$env:TEMP = $directory
$env:TMP = $directory
$source = Join-Path $PSScriptRoot 'BackgroundTask.cs'
$digest = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.Substring(0,16).ToLowerInvariant()
$launcher = Join-Path $directory "BackgroundTask-$digest.exe"
if (-not (Test-Path -LiteralPath $launcher)) { Add-Type -Path $source -OutputAssembly $launcher -OutputType WindowsApplication }
$node = (Get-Command node -ErrorAction Stop).Source
$runner = Join-Path $PSScriptRoot 'run-background.mjs'
$logs = Join-Path $projectRoot '.local/services/logs'
$name = 'SecondAlgorithm-DailyCodex'
if (-not $Apply) { [pscustomobject]@{Task=$name;Launcher=$launcher;Runner=$runner;Schedule='05:00 Asia/Shanghai';Applied=$false;ModelStarted=$false}|ConvertTo-Json;exit 0 }
$existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.State -eq 'Running' -or $existing.Actions.Count -ne 1 -or $existing.Actions[0].WorkingDirectory -ne $projectRoot) { throw 'An existing task has unexpected or active state; preserve it for inspection.' }
  Export-ScheduledTask -TaskName $name | Out-File -LiteralPath (Join-Path $directory ('before-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.xml')) -Encoding utf8
}
$arguments = '"{0}" "{1}" "{2}"' -f $node,$runner,$logs
$action = New-ScheduledTaskAction -Execute $launcher -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '05:00'
$trigger.StartBoundary = ([System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::UtcNow,'China Standard Time')).ToString('yyyy-MM-dd')+'T05:00:00+08:00'
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 12) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
$verification = Get-ScheduledTask -TaskName $name
if ($verification.Actions[0].Execute -ne $launcher) { throw 'Background launcher registration verification failed' }
& $node --input-type=module -e "import{publisherRequest}from'./scripts/lib/service-local.mjs';await publisherRequest('/api/services/report',{runner:{configured:true,seenAt:Date.now()}});"
if ($LASTEXITCODE -ne 0) { throw 'Task exists but server setup report failed; inspect local configuration.' }
[pscustomobject]@{Task=$name;Applied=$true;ModelStarted=$false;DefaultPermission='rest';Launcher='WindowsApplication -> Node, CreateNoWindow'}|ConvertTo-Json
