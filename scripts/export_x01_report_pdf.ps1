param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputPdf)
$ErrorActionPreference='Stop'
$x017DocumentPath=[System.IO.Path]::GetFullPath($InputFile)
$x017PdfPath=[System.IO.Path]::GetFullPath($OutputPdf)
$x017Workspace=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))+[System.IO.Path]::DirectorySeparatorChar
if (-not $x017DocumentPath.StartsWith($x017Workspace,[System.StringComparison]::OrdinalIgnoreCase) -or
    -not $x017PdfPath.StartsWith($x017Workspace,[System.StringComparison]::OrdinalIgnoreCase)) { throw 'Report render paths must stay inside the workspace.' }
if (-not (Test-Path -LiteralPath $x017DocumentPath)) { throw 'Missing DOCX.' }
$x017Word=$null
$x017Document=$null
try {
    $x017Word=New-Object -ComObject Word.Application
    $x017Word.Visible=$false
    $x017Word.DisplayAlerts=0
    $x017Document=$x017Word.Documents.Open($x017DocumentPath,$false,$false,$false)
    $x017Document.Fields.Update() | Out-Null
    $x017Document.Repaginate()
    $x017Document.Save()
    $x017Document.ExportAsFixedFormat($x017PdfPath,17)
    [pscustomobject]@{Pdf=$x017PdfPath;Pages=$x017Document.ComputeStatistics(2);Renderer='Microsoft Word COM hidden'} | ConvertTo-Json -Compress
} finally {
    if ($null -ne $x017Document) { $x017Document.Close($false);[System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($x017Document) | Out-Null }
    if ($null -ne $x017Word) { $x017Word.Quit();[System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($x017Word) | Out-Null }
    [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
