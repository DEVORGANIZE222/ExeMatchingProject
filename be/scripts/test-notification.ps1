param(
    [switch]$SendSampleEvent,
    [ValidateSet("all", "mentor-requested", "mentor-decision", "group-created", "student-imported")]
    [string]$Topic = "all"
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
    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "  2. SENDING SAMPLE EVENTS ACCORDING TO ARCHITECTURE    " -ForegroundColor Cyan
    Write-Host "     Source: GroupMatching / Mentor Service             " -ForegroundColor Cyan
    Write-Host "     Broker: Kafka [Message Broker]                     " -ForegroundColor Cyan
    Write-Host "     Consumer: Notification Worker                      " -ForegroundColor Cyan
    Write-Host "     Provider: SMTP Provider Gmail (default)            " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    function Send-KafkaMessage {
        param(
            [string]$TopicName,
            [string]$Key,
            [string]$Payload
        )
        $message = "$($Key):$($Payload)"
        Write-Host "`n[Publish events] Topic '$TopicName' (Key: $Key)..." -ForegroundColor Yellow
        $cmd = "echo '$message' | kafka-console-producer --bootstrap-server kafka:29092 --topic $TopicName --property parse.key=true --property key.separator=:"
        docker exec -i exe-kafka sh -c $cmd
    }

    try {
        # Check if exe-kafka is running
        $kafkaRunning = docker ps --filter "name=exe-kafka" --format "{{.Names}}"
        if (-not $kafkaRunning) {
            Write-Warning "Container 'exe-kafka' is not running. Please run 'docker compose up -d' first."
            exit 0
        }

        # 1. Mentor Requested Event (from Mentor Service)
        if ($Topic -eq "all" -or $Topic -eq "mentor-requested") {
            $reqId = [Guid]::NewGuid().ToString()
            $mentorRequestedPayload = @{
                RequestId = $reqId
                GroupId = [Guid]::NewGuid().ToString()
                MentorId = [Guid]::NewGuid().ToString()
                Message = "Kính gửi Thầy/Cô, nhóm chúng em mong muốn được Thầy/Cô hướng dẫn đề tài EXE."
                RequestedAt = (Get-Date).ToUniversalTime().ToString("o")
                MentorEmail = "mentor.test@gmail.com"
                RequesterEmail = "nhanlh@fpt.edu.vn"
                GroupName = "EXE Alpha Team"
                Topic = "Smart Agriculture IoT System"
            } | ConvertTo-Json -Compress

            Send-KafkaMessage -TopicName "mentor-requested" -Key $reqId -Payload $mentorRequestedPayload
        }

        # 2. Mentor Decision Event (from Mentor Service)
        if ($Topic -eq "all" -or $Topic -eq "mentor-decision") {
            $decId = [Guid]::NewGuid().ToString()
            $mentorDecisionPayload = @{
                RequestId = $decId
                GroupId = [Guid]::NewGuid().ToString()
                MentorId = [Guid]::NewGuid().ToString()
                IsAccepted = $true
                DecisionReason = "Đề tài có tính ứng dụng cao, nhóm có năng lực tốt. Đồng ý hướng dẫn."
                DecidedAt = (Get-Date).ToUniversalTime().ToString("o")
                RequesterEmail = "nhanlh@fpt.edu.vn"
                MentorEmail = "mentor.test@gmail.com"
                GroupName = "EXE Alpha Team"
            } | ConvertTo-Json -Compress

            Send-KafkaMessage -TopicName "mentor-decision" -Key $decId -Payload $mentorDecisionPayload
        }

        # 3. Group Created Event (from GroupMatching Service)
        if ($Topic -eq "all" -or $Topic -eq "group-created") {
            $grpId = [Guid]::NewGuid().ToString()
            $groupCreatedPayload = @{
                GroupId = $grpId
                GroupCode = "GRP-FALL2026-09"
                GroupName = "EXE Innovators"
                CreatorStudentId = [Guid]::NewGuid().ToString()
                CreatedAt = (Get-Date).ToUniversalTime().ToString("o")
                CreatorEmail = "nhanlh@fpt.edu.vn"
            } | ConvertTo-Json -Compress

            Send-KafkaMessage -TopicName "group-created" -Key $grpId -Payload $groupCreatedPayload
        }

        # 4. Student Imported Event (Legacy / Backward Compatibility)
        if ($Topic -eq "student-imported") {
            $studentId = [Guid]::NewGuid().ToString()
            $studentImportedPayload = @{
                StudentId = $studentId
                StudentCode = "SE184226"
                FullName = "Lam Hoang Nhan"
                Email = "nhanlh@fpt.edu.vn"
                SemesterCode = "FALL2026"
                ImportedAt = (Get-Date).ToUniversalTime().ToString("o")
            } | ConvertTo-Json -Compress

            Send-KafkaMessage -TopicName "student-imported" -Key $studentId -Payload $studentImportedPayload
        }

        Write-Host "`nWaiting 3 seconds for Notification Worker to consume and dispatch via SMTP..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3

        Write-Host "`nRecent logs from exe-notification-worker:" -ForegroundColor Cyan
        docker logs --tail 30 exe-notification-worker
    }
    catch {
        Write-Warning "Could not communicate with Docker containers: $_"
    }
}
