param(
    [string]$IdentityUrl = 'http://localhost:5001',
    [string]$GroupMatchingUrl = 'http://localhost:5002'
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$outputDirectory = Join-Path $repoRoot 'docs/api'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

Invoke-WebRequest -Uri "$IdentityUrl/swagger/v1/swagger.json" -OutFile (Join-Path $outputDirectory 'identity-semester.openapi.json')
Invoke-WebRequest -Uri "$GroupMatchingUrl/swagger/v1/swagger.json" -OutFile (Join-Path $outputDirectory 'group-matching.openapi.json')

Write-Output "OpenAPI exports written to $outputDirectory"
