param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 2147483647)]
    [int]$BenchmarkProcessId,
    [Parameter(Mandatory = $true)]
    [string]$OutputFile
)
$ErrorActionPreference = 'Stop'
$benchmarkGeneratedRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'generated')) + [System.IO.Path]::DirectorySeparatorChar
$benchmarkSamplePath = [System.IO.Path]::GetFullPath($OutputFile)
if (-not $benchmarkSamplePath.StartsWith($benchmarkGeneratedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Sampler output must remain inside scripts/generated.'
}
if (Test-Path -LiteralPath $benchmarkSamplePath) { throw 'Sampler does not overwrite existing evidence.' }
$benchmarkExpectedStart = $null
$benchmarkWatch = [System.Diagnostics.Stopwatch]::StartNew()
while ($true) {
    $benchmarkJava = Get-Process -Id $BenchmarkProcessId -ErrorAction SilentlyContinue
    if ($null -eq $benchmarkJava) { break }
    $benchmarkStart = $benchmarkJava.StartTime.ToUniversalTime().ToString('o')
    if ($null -eq $benchmarkExpectedStart) { $benchmarkExpectedStart = $benchmarkStart }
    if ($benchmarkExpectedStart -ne $benchmarkStart) { break } # A reused PID is not the owned Java process.
    [pscustomobject]@{
        capturedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        samplerElapsedMs = $benchmarkWatch.Elapsed.TotalMilliseconds
        processId = $BenchmarkProcessId
        cpuTotalSeconds = $benchmarkJava.CPU
        workingSetBytes = $benchmarkJava.WorkingSet64
        osThreadCount = $benchmarkJava.Threads.Count
    } | Export-Csv -LiteralPath $benchmarkSamplePath -NoTypeInformation -Append -Encoding UTF8
    Start-Sleep -Milliseconds 1000
}
