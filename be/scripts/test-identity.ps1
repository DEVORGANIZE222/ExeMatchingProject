param([switch]$HostTests, [switch]$NoRestore, [string]$PostgresHost = 'localhost')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $HostTests) {
    Push-Location $repoRoot
    try {
        & docker compose -f docker-compose.yml -f docker-compose.identity-tests.yml run --rm --build identity-tests
        if ($LASTEXITCODE -ne 0) { throw 'IdentitySemester container tests failed.' }
    }
    finally { Pop-Location }
    return
}
$settings = @{}
Get-Content -LiteralPath (Join-Path $repoRoot '.env') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $settings[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }
}
# The root .env uses Docker DNS in DB URLs; host tests use the published port.
$previousConnection = $env:TEST_POSTGRES_CONNECTION
try {
    $env:TEST_POSTGRES_CONNECTION = 'Host=' + $PostgresHost + ';Port=' + $settings['POSTGRES_PORT'] + ';Database=postgres;Username=' + $settings['POSTGRES_USER'] + ';Password=' + $settings['POSTGRES_PASSWORD']
    $testArgs = @('test', (Join-Path $repoRoot 'be/src/Tests/IdentitySemester.Tests/IdentitySemester.Tests.csproj'), '--nologo', '-v', 'minimal')
    if ($NoRestore) { $testArgs += '--no-restore' }
    & dotnet @testArgs
    if ($LASTEXITCODE -ne 0) { throw 'IdentitySemester tests failed.' }
}
finally { $env:TEST_POSTGRES_CONNECTION = $previousConnection }
