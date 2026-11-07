param(
    [ValidateSet('Prepare', 'Preflight', 'Pilot', 'Measure')]
    [string]$Action = 'Prepare',
    [ValidateSet(2, 5, 20)]
    [int[]]$Clients = @(2),
    [ValidateSet('direct', 'bounded', 'both')]
    [string]$Mode = 'both',
    [ValidateRange(1, 3)]
    [int]$Repeat = 1,
    [switch]$Rebuild
)
$ErrorActionPreference = 'Stop'
$benchmarkPreviousPassword = $env:PGPASSWORD
try {
    if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
        $benchmarkSecret = Read-Host 'Mat khau PostgreSQL cho TEST benchmark' -AsSecureString
        $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $benchmarkSecret).Password
        Remove-Variable benchmarkSecret
    }
    $benchmarkArguments = @((Join-Path $PSScriptRoot 'run_x01_benchmark.py'),
        '--action', $Action.ToLowerInvariant(), '--mode', $Mode, '--repeat', "$Repeat", '--clients')
    $benchmarkArguments += @($Clients | ForEach-Object { "$_" })
    if ($Rebuild) { $benchmarkArguments += '--rebuild' }
    & python @benchmarkArguments
    if ($LASTEXITCODE -ne 0) { throw 'X01 failed; inspect the evidence directory. No automatic retry.' }
} finally {
    $env:PGPASSWORD = $benchmarkPreviousPassword
}
