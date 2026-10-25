# E01: migration, backup, pinned import, reviewed promotion, and live audit.
# Password is read without echo unless PGPASSWORD is already set by the caller.
[CmdletBinding()]
param(
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$DbName = 'huyenco',
    [string]$DbUser = 'postgres',
    [string]$PdfDir = (Join-Path $env:USERPROFILE 'Downloads'),
    [ValidateRange(30,1800)][int]$MigrationTimeoutSeconds = 240
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$server = Join-Path $repo 'server'
$backupDir = Join-Path $PSScriptRoot 'generated\db-backups'
$logDir = Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

function Find-Psql {
    $found = Get-Command 'psql.exe' -ErrorAction SilentlyContinue
    if ($found) { return $found.Source }
    $installDir = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $installDir) {
        $candidates = @(Get-ChildItem $installDir -Directory |
            Sort-Object { if ($_.Name -match '^\d+$') { [int]$_.Name } else { 0 } } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' } |
            Where-Object { Test-Path $_ })
        if ($candidates.Count) { return $candidates[0] }
    }
    throw 'psql.exe was not found.'
}

function Invoke-Query([string]$Sql) {
    $output = & $script:psql -X -w -q -A -t -v ON_ERROR_STOP=1 -h $DbHost -p "$DbPort" `
        -U $DbUser -d $DbName -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL query failed: $($output -join ' ')" }
    return ($output | Out-String).Trim()
}

function Invoke-PythonImport([string[]]$Extras) {
    & python (Join-Path $PSScriptRoot 'import_hexagram_glosses.py') `
        --pdf-dir $PdfDir --host $DbHost --port $DbPort --database $DbName `
        --user $DbUser --psql $script:psql @Extras
    if ($LASTEXITCODE -ne 0) { throw 'E01 import/review failed. Existing records are protected.' }
}

$previous = @{}
foreach ($name in @('PGPASSWORD','DB_PASSWORD','DB_URL','DB_USERNAME','JAVA_HOME','MAVEN_SKIP_RC')) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process')
}
try {
    if (-not $env:PGPASSWORD) {
        $secret = Read-Host 'Nhap mat khau PostgreSQL (khong hien ky tu)' -AsSecureString
        $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
        $secret.Dispose()
    }
    $env:DB_PASSWORD = $env:PGPASSWORD
    $env:DB_USERNAME = $DbUser
    $env:DB_URL = "jdbc:postgresql://${DbHost}:${DbPort}/${DbName}"
    $env:MAVEN_SKIP_RC = '1'
    if (-not $env:JAVA_HOME) {
        $javaDir = @('jdk-17','jdk-21','jdk-24') |
            ForEach-Object { Join-Path $env:ProgramFiles "Java\$_" } |
            Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
        if (-not $javaDir) { throw 'JDK 17+ is required.' }
        $env:JAVA_HOME = $javaDir
    }
    $script:psql = Find-Psql

    Write-Host '1/6: Verify pinned CSV, manifest and PDF before changing DB.'
    Invoke-PythonImport @()

    Write-Host '2/6: Verify PostgreSQL and backup the entire database.'
    if ((Invoke-Query 'SELECT current_database();') -ne $DbName) { throw 'Connected to a different database.' }
    $dump = Join-Path (Split-Path $script:psql) 'pg_dump.exe'
    if (-not (Test-Path $dump)) { throw 'pg_dump.exe is required for a full backup.' }
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
    $backup = Join-Path $backupDir "before-e01-schema-$stamp.dump"
    & $dump -w -Fc -h $DbHost -p "$DbPort" -U $DbUser -f $backup $DbName
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backup) -or (Get-Item $backup).Length -lt 1024) {
        throw 'Full PostgreSQL backup failed; migration not started.'
    }
    Write-Host "Full backup: $backup"

    Write-Host '3/6: Apply Flyway up to V10 and check migration history.'
    $migrationOut = Join-Path $logDir 'e01_migration_stdout.log'
    $migrationErr = Join-Path $logDir 'e01_migration_stderr.log'
    $process = Start-Process -FilePath $env:ComSpec `
        -ArgumentList @('/d','/c','mvnw.cmd -B -ntp -Pdatabase flyway:migrate') `
        -WorkingDirectory $server -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $migrationOut -RedirectStandardError $migrationErr
    $null = $process.Handle
    try {
        if (-not $process.WaitForExit($MigrationTimeoutSeconds * 1000)) {
            throw "Flyway timeout. See $migrationOut and $migrationErr"
        }
        $process.WaitForExit()
        $process.Refresh()
        if ($process.ExitCode -ne 0) { throw "Flyway failed. See $migrationOut and $migrationErr" }
    } finally {
        $process.Refresh()
        if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null }
    }
    if ((Invoke-Query "SELECT count(*) FROM flyway_schema_history WHERE version='10' AND success;") -ne '1') {
        throw 'Migration V10 has not been applied.'
    }

    Write-Host '4/6: Import SOURCE_LOCATED, then review exactly 64 NAME_GLOSS entries.'
    Invoke-PythonImport @('--apply')
    Invoke-PythonImport @('--apply','--review')

    Write-Host '5/6: Repeat reviewed import to confirm idempotency.'
    Invoke-PythonImport @('--apply','--review')

    Write-Host '6/6: Live audit with source matching and review status.'
    & python (Join-Path $PSScriptRoot 'audit_tv3.py') --live --host $DbHost --port $DbPort `
        --database $DbName --user $DbUser --psql $script:psql --pdf-dir $PdfDir `
        --output (Join-Path $logDir 'tv3_audit_report.md')
    if ($LASTEXITCODE -ne 0) { throw 'Live TV3 audit has failures.' }
    Write-Host 'E01 complete: 64 scoped NAME_GLOSS records reviewed and audited.'
} finally {
    foreach ($name in $previous.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
}
