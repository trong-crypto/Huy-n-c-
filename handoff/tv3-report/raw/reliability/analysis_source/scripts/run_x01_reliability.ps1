param(
    [ValidateSet('all', 'idempotency', 'overload')]
    [string]$Suite = 'all'
)
$ErrorActionPreference = 'Stop'
$x01ReliabilityPreviousPassword = $env:PGPASSWORD
try {
    if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
        $x01ReliabilitySecret = Read-Host 'Mat khau PostgreSQL cho TEST benchmark' -AsSecureString
        $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $x01ReliabilitySecret).Password
        Remove-Variable x01ReliabilitySecret
    }
    & python (Join-Path $PSScriptRoot 'run_x01_reliability.py') --suite $Suite
    if ($LASTEXITCODE -ne 0) { throw 'X01.5 failed. Evidence preserved; no automatic retry.' }
} finally {
    $env:PGPASSWORD = $x01ReliabilityPreviousPassword
}
