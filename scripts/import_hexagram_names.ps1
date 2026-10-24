# Import 64 source-located names. Review by TV2 remains a separate step.
[CmdletBinding()]
param(
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$DbName = 'huyenco',
    [string]$DbUser = 'postgres'
)
$ErrorActionPreference = 'Stop'
$savedPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
    $securePassword = Read-Host 'Nhap mat khau PostgreSQL (khong hien ky tu)' -AsSecureString
    $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
    & python (Join-Path $PSScriptRoot 'import_hexagram_names.py') --apply `
        --host $DbHost --port $DbPort --database $DbName --user $DbUser
    if ($LASTEXITCODE -ne 0) { throw 'Nhap ten que chua hoan tat.' }
    & python (Join-Path $PSScriptRoot 'audit_tv3.py') --live `
        --host $DbHost --port $DbPort --database $DbName --user $DbUser
    if ($LASTEXITCODE -ne 0) { throw 'Kiem toan chua dat; xem bao cao.' }
    Write-Host 'HOAN THANH: da nhap ten que; cho TV2 doi chieu truoc VERIFIED.'
} finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $savedPassword, 'Process')
}
