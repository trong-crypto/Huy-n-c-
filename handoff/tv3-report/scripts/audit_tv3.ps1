# Audit read-only: password is requested locally and never saved to source files.
[CmdletBinding()]
param(
    [string]$DbHost = '127.0.0.1',
    [int]$DbPort = 5432,
    [string]$DbName = 'huyenco',
    [string]$DbUser = 'postgres'
)

$ErrorActionPreference = 'Stop'
$savedPgPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
    $securePassword = Read-Host 'Nhap mat khau PostgreSQL (khong hien ky tu)' -AsSecureString
    $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
    & python (Join-Path $PSScriptRoot 'audit_tv3.py') --live --host $DbHost `
        --port $DbPort --database $DbName --user $DbUser
    if ($LASTEXITCODE -ne 0) { throw "Kiem toan that bai, exit code $LASTEXITCODE" }
    Write-Host 'DA XONG: Mo scripts/generated/tv3_audit_report.md de xem ket qua.'
} finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $savedPgPassword, 'Process')
}
