param(
    [switch]$SendSampleEvent
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  1. RUNNING NOTIFICATION UNIT TESTS    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$testProject = Join-Path $repoRoot 'be/src/Tests/Notification.Tests/Notification.Tests.csproj'
& dotnet test $testProject -v normal

if ($LASTEXITCODE -ne 0) {
    Write-Error "Notification unit tests failed."
    exit 1
}

Write-Host "`nAll Unit Tests passed successfully!" -ForegroundColor Green

if ($SendSampleEvent) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  2. SENDING SAMPLE EVENT TO KAFKA      " -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $studentId = [Guid]::NewGuid().ToString()
    $sampleEvent = @{
        StudentId = $studentId
        StudentCode = "SE184226"
        FullName = "Lam Hoang Nhan"
        Email = "nhanlh@fpt.edu.vn"
        SemesterCode = "FALL2026"
        ImportedAt = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json -Compress

    $message = "$($studentId):$($sampleEvent)"

    try {
        Write-Host "Publishing event to topic 'student-imported' inside container 'exe-kafka'..."
        $cmd = "echo '$message' | kafka-console-producer --bootstrap-server kafka:29092 --topic student-imported --property parse.key=true --property key.separator=:"
        docker exec -i exe-kafka sh -c $cmd

        Write-Host "Event sent! Waiting 3 seconds for Notification Worker to process..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3

        Write-Host "`nRecent logs from exe-notification-worker:" -ForegroundColor Cyan
        docker logs --tail 25 exe-notification-worker
    }
    catch {
        Write-Warning "Could not connect to Docker containers. Ensure 'docker compose up -d' is running."
    }
}
