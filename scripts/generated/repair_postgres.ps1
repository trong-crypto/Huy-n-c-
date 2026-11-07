$ErrorActionPreference = 'Stop'
$source = 'C:\Users\abc\Documents\Codex\huyenco-postgres-recovery-20261104\pg18-complete'
$install = 'C:\Program Files\PostgreSQL\18'
$data = Join-Path $install 'data'
$backup = 'C:\Users\abc\Documents\Codex\huyenco-postgres-recovery-20261104\pg18-data-before-reinstall.tar.gz'
$log = 'C:\Users\abc\Documents\Codex\huyenco-postgres-recovery-20261104\repair.log'
Start-Transcript -LiteralPath $log -Force | Out-Null
try {
    if (-not (Test-Path -LiteralPath $backup)) { throw 'Cluster backup missing' }
    if ((Get-Content -LiteralPath (Join-Path $data 'PG_VERSION')).Trim() -ne '18') { throw 'Cluster version mismatch' }
    if (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid')) { throw 'Cluster may be running' }
    foreach ($part in @('bin', 'lib', 'share')) {
        if (-not (Test-Path -LiteralPath (Join-Path $source $part))) { throw "Extract missing: $part" }
        & robocopy.exe (Join-Path $source $part) (Join-Path $install $part) /E /COPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS
        if ($LASTEXITCODE -ge 8) { throw "Copy failed: $part ($LASTEXITCODE)" }
        Write-Output "Copied $part"
    }
    $bin = Join-Path $install 'bin'
    & (Join-Path $bin 'postgres.exe') --version
    if ($LASTEXITCODE -ne 0) { throw 'postgres binary failed' }
    & (Join-Path $bin 'pg_ctl.exe') --version
    if ($LASTEXITCODE -ne 0) { throw 'pg_ctl binary failed' }
    $service = Get-Service -Name 'postgresql-x64-18' -ErrorAction SilentlyContinue
    if (-not $service) {
        & (Join-Path $bin 'pg_ctl.exe') register -D $data -N 'postgresql-x64-18' -U 'NT AUTHORITY\NetworkService' -S auto
        if ($LASTEXITCODE -ne 0) { throw 'Service registration failed' }
        Write-Output 'Service registered'
    }
    Start-Service -Name 'postgresql-x64-18'
    $service = Get-Service -Name 'postgresql-x64-18'
    Write-Output "Service status: $($service.Status)"
    & (Join-Path $bin 'pg_isready.exe') -h '127.0.0.1' -p 5432
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL not ready after service start' }
    Write-Output 'REPAIR_OK'
} catch {
    Write-Error $_
    exit 1
} finally {
    Stop-Transcript | Out-Null
}
