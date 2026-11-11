param(
    [string]$Model = 'gemini-3.1-flash-lite'
)
$ErrorActionPreference = 'Stop'
$configRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'server/.local'
$keyFile = Join-Path $configRoot 'gemini-key.dpapi'
if (!(Test-Path -LiteralPath $keyFile)) {
    throw 'Chua co khoa Gemini cuc bo. Can luu khoa ma hoa cho tai khoan Windows nay.'
}
$protected = Get-Content -LiteralPath $keyFile -Raw -ErrorAction Stop
$secure = ConvertTo-SecureString $protected.Trim() -ErrorAction Stop
$env:AI_API_KEY = [pscredential]::new('gemini', $secure).GetNetworkCredential().Password
$env:AI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
$env:AI_API_MODEL = $Model
$env:AI_PROVIDER = 'openai-compatible'
Write-Host "Gemini da cau hinh cho Backend, model $Model."
