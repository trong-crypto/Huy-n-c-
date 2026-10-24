# Chay trong PowerShell tai may Windows dang cai PostgreSQL.
# Flyway V1-V3 -> seed sach -> V4/latest -> cau truc/ten que -> audit.
# Dung PGPASSWORD da co hoac nhap an; khong truyen password tren command line.
[CmdletBinding()]
param(
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$DbName = 'huyenco',
    [string]$DbUser = 'postgres',
    [ValidateRange(30, 1800)]
    [int]$MigrationTimeoutSeconds = 240,
    [string]$PdfDir = (Join-Path $env:USERPROFILE 'Downloads'),
    [string]$AuditOutput = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serverDir = Join-Path $repoRoot 'server'
$importer = Join-Path $PSScriptRoot 'import_book_knowledge.py'
if ([string]::IsNullOrWhiteSpace($AuditOutput)) {
    $AuditOutput = Join-Path $PSScriptRoot 'generated\tv3_audit_report.md'
}

function Find-Psql {
    $command = Get-Command 'psql.exe' -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $installRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $installRoot) {
        $candidates = @(Get-ChildItem -Path $installRoot -Directory |
            Sort-Object { if ($_.Name -match '^\d+$') { [int]$_.Name } else { 0 } } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' } |
            Where-Object { Test-Path $_ })
        if ($candidates.Count -gt 0) { return $candidates[0] }
    }
    throw 'Khong tim thay psql.exe. Hay cai PostgreSQL client.'
}

function Invoke-Scalar([string]$Sql) {
    $output = & $script:psql -X -w -A -t -v ON_ERROR_STOP=1 -h $DbHost `
        -p "$DbPort" -U $DbUser -d $DbName -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL bao loi: $($output -join ' ')"
    }
    return ($output | Out-String).Trim()
}

function Test-ReviewMigrationApplied {
    if ((Invoke-Scalar "SELECT to_regclass('public.flyway_schema_history') IS NOT NULL;") -ne 't') {
        return $false
    }
    return (Invoke-Scalar "SELECT EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE version='4' AND success);") -eq 't'
}

function Invoke-Flyway([string]$Target) {
    # One-shot Flyway Maven goal. Never launch the WebSocket server to migrate.
    $stdoutLog = Join-Path $PSScriptRoot 'generated\migration_stdout.log'
    $stderrLog = Join-Path $PSScriptRoot 'generated\migration_stderr.log'
    New-Item -ItemType Directory -Path (Split-Path $stdoutLog) -Force | Out-Null
    $command = 'mvnw.cmd -B -ntp -Pdatabase flyway:migrate'
    if ($Target -eq '3') { $command += ' -Dflyway.target=3' }
    elseif ($Target -ne 'latest') { throw 'Target Flyway khong hop le.' }
    $proc = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/c', $command) `
        -WorkingDirectory $serverDir -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    # Retain the process handle: Windows PowerShell can otherwise return a null ExitCode.
    $null = $proc.Handle
    try {
        if (-not $proc.WaitForExit($MigrationTimeoutSeconds * 1000)) {
            throw "Flyway vuot thoi gian cho. Xem $stdoutLog va $stderrLog"
        }
        $proc.WaitForExit()
        $proc.Refresh()
        if ($proc.ExitCode -ne 0) { throw "Flyway that bai. Xem $stdoutLog va $stderrLog" }
    } finally {
        $proc.Refresh()
        if (-not $proc.HasExited) {
            & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
        }
    }
}

$script:psql = Find-Psql
$savedPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
$savedDbPassword = [Environment]::GetEnvironmentVariable('DB_PASSWORD', 'Process')
$savedDbUrl = [Environment]::GetEnvironmentVariable('DB_URL', 'Process')
$savedDbUser = [Environment]::GetEnvironmentVariable('DB_USERNAME', 'Process')
$savedJavaHome = $env:JAVA_HOME
$savedMavenSkipRc = $env:MAVEN_SKIP_RC

try {
    if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
        $securePassword = Read-Host 'Nhap mat khau PostgreSQL (khong hien ky tu)' -AsSecureString
        $plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
    } else { $plainPassword = $env:PGPASSWORD }
    if (-not $env:JAVA_HOME) {
        $jdk = @('jdk-17', 'jdk-21', 'jdk-24') | ForEach-Object { Join-Path $env:ProgramFiles "Java\$_" } |
            Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
        if (-not $jdk) { throw 'Can JDK 17+; hay dat JAVA_HOME truoc khi chay.' }
        $env:JAVA_HOME = $jdk
    }
    $env:MAVEN_SKIP_RC = '1'
    $env:PGPASSWORD = $plainPassword
    $env:DB_PASSWORD = $plainPassword
    $env:DB_USERNAME = $DbUser
    $env:DB_URL = "jdbc:postgresql://${DbHost}:${DbPort}/${DbName}"
    $plainPassword = $null

    Write-Host '1/8: Kiem tra ket noi PostgreSQL...'
    $database = Invoke-Scalar 'SELECT current_database();'
    if ($database -ne $DbName) { throw "Ket noi sai database: $database" }

    Write-Host '2/8: Flyway V1-V3 neu chua co V4...'
    if (-not (Test-ReviewMigrationApplied)) { Invoke-Flyway '3' }

    Write-Host '3/8: Kiem tra hai PDF va nhap du lieu sach...'
    & python $importer --host $DbHost --port $DbPort --user $DbUser `
        --database $DbName --psql $script:psql --pdf-dir $PdfDir --apply
    if ($LASTEXITCODE -ne 0) { throw 'Import that bai; database khong duoc xac nhan la da nhap.' }

    Write-Host '4/8: Flyway V4 va cac migration moi; kiem checksum...'
    Invoke-Flyway 'latest'
    if (-not (Test-ReviewMigrationApplied)) { throw 'V4 chua hoan tat.' }

    Write-Host '5/8: Nap 64 cau truc que va 384 hao (chua VERIFIED)...'
    $hexagramSql = Join-Path $PSScriptRoot 'seed_hexagram_structure.sql'
    & $script:psql -X -w -q -v ON_ERROR_STOP=1 -h $DbHost -p "$DbPort" `
        -U $DbUser -d $DbName -f $hexagramSql
    if ($LASTEXITCODE -ne 0) { throw 'Nhap cau truc 64 que that bai; SQL transaction se rollback.' }

    Write-Host '6/8: Nhap 64 ten que co trang nguon (SOURCE_LOCATED)...'
    & python (Join-Path $PSScriptRoot 'import_hexagram_names.py') --apply --host $DbHost `
        --port $DbPort --database $DbName --user $DbUser --psql $script:psql --pdf-dir $PdfDir
    if ($LASTEXITCODE -ne 0) { throw 'Nhap ten que that bai; xem loi nguon/ban ghi duoc bao ve.' }

    Write-Host 'Ap dung bien ban doi chieu ten 64 que ngay 24/10 (Codex, cung cong cu luot hai)...'
    & python (Join-Path $PSScriptRoot 'verify_hexagram_names.py') --apply --host $DbHost `
        --port $DbPort --database $DbName --user $DbUser --psql $script:psql --pdf-dir $PdfDir
    if ($LASTEXITCODE -ne 0) { throw 'Chua duyet ten: dung lai de kiem bien ban/nguon/ban ghi duoc bao ve.' }

    Write-Host 'Ap dung bien ban 8 quai ngay 24/10; khong duyet nguon OBJECT_COUNT...'
    & python (Join-Path $PSScriptRoot 'verify_trigram_rule.py') --apply --host $DbHost `
        --port $DbPort --database $DbName --user $DbUser --psql $script:psql --pdf-dir $PdfDir
    if ($LASTEXITCODE -ne 0) { throw 'Chua duyet bang quai: kiem bien ban/nguon/du lieu truoc khi tiep tuc.' }

    Write-Host 'S02: Nhap 60 Can Chi/hanh menh tu Tam The PDF11...'
    & python (Join-Path $PSScriptRoot 'import_tam_the_year_elements.py') --apply --host $DbHost `
        --port $DbPort --database $DbName --user $DbUser --psql $script:psql --pdf-dir $PdfDir
    if ($LASTEXITCODE -ne 0) { throw 'Nhap bang 60 Can Chi that bai; kiem nguon/du lieu duoc bao ve.' }
    Write-Host 'S02: Ap dung bien ban luot hai, chi duyet anh xa Can Chi -> hanh...'
    & python (Join-Path $PSScriptRoot 'import_tam_the_year_elements.py') --apply --review --host $DbHost `
        --port $DbPort --database $DbName --user $DbUser --psql $script:psql --pdf-dir $PdfDir
    if ($LASTEXITCODE -ne 0) { throw 'Chua duyet bang 60 Can Chi; kiem bien ban va trang nguon.' }

    Write-Host '7/8: Kiem dem ban ghi...'
    $counts = Invoke-Scalar @'
SELECT 'source_books', count(*) FROM source_books
UNION ALL SELECT 'source_sections', count(*) FROM source_sections
UNION ALL SELECT 'calculation_rules', count(*) FROM calculation_rules
UNION ALL SELECT 'trigrams', count(*) FROM trigrams
UNION ALL SELECT 'tam_the_hour_anchors', count(*) FROM tam_the_hour_anchors
UNION ALL SELECT 'tam_the_lookup_entries', count(*) FROM tam_the_lookup_entries
UNION ALL SELECT 'hexagrams', count(*) FROM hexagrams
UNION ALL SELECT 'hexagram_lines', count(*) FROM hexagram_lines
UNION ALL SELECT 'interpretations', count(*) FROM interpretations
ORDER BY 1;
'@
    Write-Host $counts
    Write-Host "8/8: Kiem toan DB, bao cao $AuditOutput ..."
    & python (Join-Path $PSScriptRoot 'audit_tv3.py') --live --host $DbHost `
        --port $DbPort --database $DbName --user $DbUser --psql $script:psql --pdf-dir $PdfDir --output $AuditOutput
    if ($LASTEXITCODE -ne 0) { throw 'Kiem toan that bai; xem cac bao cao va loi.' }
    Write-Host 'HOAN THANH: 64 ten da duyet theo bien ban; cac quy tac/loi luan con thieu van giu nguyen.'
} finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $savedPassword, 'Process')
    [Environment]::SetEnvironmentVariable('DB_PASSWORD', $savedDbPassword, 'Process')
    [Environment]::SetEnvironmentVariable('DB_URL', $savedDbUrl, 'Process')
    [Environment]::SetEnvironmentVariable('DB_USERNAME', $savedDbUser, 'Process')
    $env:JAVA_HOME = $savedJavaHome
    $env:MAVEN_SKIP_RC = $savedMavenSkipRc
}
