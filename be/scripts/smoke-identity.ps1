$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$settings = @{}
Get-Content -LiteralPath (Join-Path $repoRoot '.env') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $settings[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }
}
$api = 'http://localhost:' + $settings['IDENTITY_PORT']
$gateway = 'http://localhost:' + $settings['GATEWAY_PORT']
function Check($condition, $message) { if (-not $condition) { throw $message }; Write-Output ('PASS: ' + $message) }
$body = @{email=$settings['BOOTSTRAP_ADMIN_EMAIL'];password=$settings['BOOTSTRAP_ADMIN_PASSWORD']} | ConvertTo-Json
$login = Invoke-RestMethod -Uri ($gateway+'/api/auth/login') -Method Post -ContentType 'application/json' -Body $body
$headers = @{Authorization=('Bearer '+$login.data.token)}
Check ($login.data.token.Split('.').Count -eq 3) 'Gateway login issues JWT'
$anonymous = Invoke-WebRequest -Uri ($gateway+'/api/students') -SkipHttpErrorCheck
Check ($anonymous.StatusCode -eq 401) 'Gateway denies anonymous student requests'
$me = Invoke-RestMethod -Uri ($gateway+'/api/auth/me') -Headers $headers
Check ($me.data.role -eq 'Admin') 'Authenticated account role'
$swagger = Invoke-RestMethod -Uri ($api+'/swagger/v1/swagger.json')
Check ($null -ne $swagger.paths.'/api/students/import/excel') 'Swagger includes Excel import'
$suffix = [Guid]::NewGuid().ToString('N').Substring(0,10)
$semester = $null
$student = $null
try {
    $semesterBody = @{code=('SMOKE'+$suffix);name='Temporary smoke semester';startDate='2027-01-01T00:00:00Z';endDate='2027-06-01T00:00:00Z';registrationDeadline='2027-02-01T00:00:00Z';topicDeadline='2027-03-01T00:00:00Z';mentorDeadline='2027-04-01T00:00:00Z'} | ConvertTo-Json
    $semester = (Invoke-RestMethod -Uri ($gateway+'/api/semesters') -Headers $headers -Method Post -ContentType 'application/json' -Body $semesterBody).data
    Check ($null -ne $semester.id) 'Create semester through Nginx'
    $studentCode = 'SMOKE'+$suffix
    $studentPassword = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    $studentBody = @{semesterCode=$semester.code;initialPassword=$studentPassword;student=@{studentCode=$studentCode;fullName='Smoke Student';email=($suffix+'@smoke.invalid');major='SE'}} | ConvertTo-Json
    $student = (Invoke-RestMethod -Uri ($gateway+'/api/students') -Headers $headers -Method Post -ContentType 'application/json' -Body $studentBody).data
    Check ($null -ne $student.id) 'Create student through Nginx'
    $studentLogin = Invoke-RestMethod -Uri ($gateway+'/api/auth/login') -Method Post -ContentType 'application/json' -Body (@{email=$student.email;password=$studentPassword} | ConvertTo-Json)
    $studentHeaders = @{Authorization=('Bearer '+$studentLogin.data.token)}
    $forbidden = Invoke-WebRequest -Uri ($gateway+'/api/students') -Headers $studentHeaders -SkipHttpErrorCheck
    Check ($forbidden.StatusCode -eq 403) 'Gateway + API enforce Student/Admin separation'
    $profile = Invoke-RestMethod -Uri ($gateway+'/api/students/'+$student.id) -Headers $studentHeaders
    Check ($profile.data.id -eq $student.id) 'Student can read own profile'
    $records = & docker exec exe-kafka kafka-console-consumer --bootstrap-server kafka:29092 --topic student-imported --from-beginning --timeout-ms 15000 --property print.key=true 2>&1
    Check (($records -join "`n").Contains($studentCode.ToUpperInvariant())) 'Real Kafka consumer receives StudentImportedEvent from Service 1'
}
finally {
    if ($null -ne $student) {
        Invoke-RestMethod -Uri ($gateway+'/api/students/'+$student.id) -Headers $headers -Method Delete | Out-Null
        # Remove only this script's generated test account and its synthetic event.
        $userId = [Guid]::Parse($student.userId).ToString()
        $eventStudentId = [Guid]::Parse($student.id).ToString()
        $sql = 'DELETE FROM "StudentEventOutbox" WHERE "Payload"::jsonb->>''StudentId'' = ''' + $eventStudentId + '''; DELETE FROM "Users" WHERE "Id" = ''' + $userId + ''';'
        $sql | docker exec -i exe-postgres psql -U $settings['POSTGRES_USER'] -d identity_db -v ON_ERROR_STOP=1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Synthetic test account cleanup failed.' }
    }
    if ($null -ne $semester) { Invoke-RestMethod -Uri ($gateway+'/api/semesters/'+$semester.id) -Headers $headers -Method Delete | Out-Null }
}
Write-Output 'Docker smoke checks finished. Only generated smoke records were removed; Kafka retains its synthetic test event.'
