# M02 knowledge import. Default is dry run; -Apply requires an explicit existing DB.
param(
    [switch]$Apply,
    [string]$DbName,
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$DbUser = 'postgres',
    [string]$PdfDir = (Join-Path $env:USERPROFILE 'Downloads')
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$saved = @{}
foreach ($key in @('PGPASSWORD','PGCONNECT_TIMEOUT','DB_URL','DB_USERNAME','DB_PASSWORD','JAVA_HOME','MAVEN_SKIP_RC')) {
    $saved[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
}
try {
    Push-Location $root
    try {
        & python '.\scripts\check_m01_readings.py' --pdf-dir $PdfDir
        if ($LASTEXITCODE -ne 0) { throw 'M01 source validation failed; database unchanged.' }
        if (-not $Apply) {
            & python '.\scripts\import_m02_readings.py' --pdf-dir $PdfDir
            if ($LASTEXITCODE -ne 0) { throw 'M02 dry run failed.' }
            return
        }
        if ([string]::IsNullOrWhiteSpace($DbName) -or $DbName -notmatch '^[a-zA-Z0-9_]+$' -or
            $DbName -in @('postgres','template0','template1')) {
            throw 'Specify an existing project/TEST -DbName; no default production target.'
        }
        $psqlPath = & python -c "from scripts.import_book_knowledge import find_psql; print(find_psql('psql'))"
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL tools not found.' }
        $postgresBin = Split-Path $psqlPath -Parent
        if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
            $secure = Read-Host 'Nhap mat khau PostgreSQL (khong hien ky tu)' -AsSecureString
            $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer) }
            finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
        }
        $env:PGCONNECT_TIMEOUT = '10'
        $actual = & $psqlPath -X -w -A -t -h $DbHost -p $DbPort -U $DbUser -d $DbName -c 'SELECT current_database()'
        if ($LASTEXITCODE -ne 0 -or $actual -ne $DbName) { throw 'Database connection/identity failed.' }
        $backupDir = Join-Path $PSScriptRoot 'generated\db-backups'
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        $backupPath = Join-Path $backupDir ('before-m02-schema-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ') + '.dump')
        & (Join-Path $postgresBin 'pg_dump.exe') -w -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fc -f $backupPath
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backupPath) -or
            (Get-Item -LiteralPath $backupPath).Length -eq 0) { throw 'Full pre-migration backup failed.' }
        Write-Host "Full pre-migration backup: $backupPath"
        $env:DB_URL = "jdbc:postgresql://${DbHost}:${DbPort}/${DbName}"
        $env:DB_USERNAME = $DbUser
        $env:DB_PASSWORD = $env:PGPASSWORD
        $env:MAVEN_SKIP_RC = '1'
        if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
            $env:JAVA_HOME = Join-Path $env:ProgramFiles 'Java\jdk-17'
        }
        Push-Location (Join-Path $root 'server')
        try {
            & '.\mvnw.cmd' -o -B -ntp -Pdatabase '-Dflyway.target=12' flyway:migrate
            if ($LASTEXITCODE -ne 0) { throw 'Flyway failed; use the pre-migration backup if recovery is needed.' }
        } finally { Pop-Location }
        & python '.\scripts\import_m02_readings.py' --apply --database $DbName --host $DbHost `
            --port $DbPort --user $DbUser --psql $psqlPath --pdf-dir $PdfDir
        if ($LASTEXITCODE -ne 0) { throw 'M02 import failed; do not bypass its source/data guard.' }
        Write-Host 'M02 data import complete. Runtime/API integration is a separate task.'
    } finally { Pop-Location }
} finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') }
}
