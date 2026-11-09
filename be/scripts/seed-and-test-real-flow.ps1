<#!
Seeds a non-destructive, real PostgreSQL scenario through the public gateway and
checks the IdentitySemester + GroupMatching workflow end-to-end.

The generated accounts use a per-run password that is never printed.  The script
does not reset Docker volumes, drop databases, or modify an existing semester.
#>
[CmdletBinding()]
param(
    [string]$GatewayUrl = 'http://localhost:8080',
    [string]$SemesterCode = 'FLOW26'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envFile = Join-Path $projectRoot '.env'

function Get-EnvValue([string]$name) {
    if (-not (Test-Path -LiteralPath $envFile)) { throw "Missing local environment file: $envFile" }
    $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^$([regex]::Escape($name))=(.*)$" } | Select-Object -First 1
    if (-not $line) { throw "Required local configuration '$name' is missing." }
    return ($line -replace "^$([regex]::Escape($name))=", '').Trim('"')
}

function Invoke-Api([string]$method, [string]$path, $body, [string]$token) {
    $headers = @{}
    if ($token) { $headers.Authorization = "Bearer $token" }
    $params = @{ Uri = "$($GatewayUrl.TrimEnd('/'))$path"; Method = $method; Headers = $headers; UseBasicParsing = $true; SkipHttpErrorCheck = $true }
    if ($null -ne $body) {
        $params.Body = ($body | ConvertTo-Json -Depth 12 -Compress)
        $params.ContentType = 'application/json'
    }
    $response = Invoke-WebRequest @params
    $payload = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        $message = if ($payload -and $payload.message) { $payload.message } else { "HTTP $($response.StatusCode) for $method $path" }
        throw $message
    }
    if ($null -ne $payload -and $null -ne $payload.data) { return $payload.data }
    return $null
}

function Utc([datetime]$value) { $value.ToUniversalTime().ToString('o') }

$adminEmail = Get-EnvValue 'BOOTSTRAP_ADMIN_EMAIL'
$adminPassword = Get-EnvValue 'BOOTSTRAP_ADMIN_PASSWORD'
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$studentPassword = "Flow-$suffix-Password!"
$now = [datetime]::UtcNow

Write-Host "Signing in as the configured local administrator..."
$adminLogin = Invoke-Api 'POST' '/api/auth/login' @{ email = $adminEmail; password = $adminPassword } $null
$adminToken = $adminLogin.token
if (-not $adminToken) { throw 'Admin login did not return a JWT.' }

$code = "$SemesterCode$suffix".ToUpperInvariant()
$semester = Invoke-Api 'POST' '/api/semesters' @{
    code = $code
    name = "Real API verification $suffix"
    startDate = Utc($now.AddDays(-7))
    endDate = Utc($now.AddDays(40))
    registrationDeadline = Utc($now.AddDays(7))
    topicDeadline = Utc($now.AddDays(21))
    mentorDeadline = Utc($now.AddDays(30))
} $adminToken

Write-Host "Importing real roster records into $code..."
$students = 1..9 | ForEach-Object {
    $index = $_.ToString('00')
    @{ studentCode = "FLOW$suffix$index"; fullName = "Flow Student $index"; email = "flow.$suffix.$index@fpt.edu.vn"; major = 'Software Engineering' }
}
Invoke-Api 'POST' '/api/students/import' @{ semesterCode = $code; students = @($students); initialPassword = $studentPassword } $adminToken | Out-Null

# Exercise student create/update/delete without removing the persistent flow roster.
$temporary = Invoke-Api 'POST' '/api/students' @{
    semesterCode = $code
    student = @{ studentCode = "FLOW$($suffix)10"; fullName = 'Temporary Flow Student'; email = "flow.$suffix.10@fpt.edu.vn"; major = 'Software Engineering' }
    initialPassword = $studentPassword
} $adminToken
Invoke-Api 'PUT' "/api/students/$($temporary.id)" @{ fullName = 'Updated Temporary Flow Student'; major = 'Information Technology' } $adminToken | Out-Null
Invoke-Api 'DELETE' "/api/students/$($temporary.id)" $null $adminToken | Out-Null

$roster = Invoke-Api 'GET' "/api/students?semesterCode=$code&page=1&pageSize=50&sortBy=code" $null $adminToken
if ($roster.totalCount -ne 9) { throw "Expected 9 persistent flow students; received $($roster.totalCount)." }
$whitelist = Invoke-Api 'GET' '/api/google-access' $null $adminToken
if (@($whitelist | Where-Object { $_.email -like "flow.$suffix.*@fpt.edu.vn" }).Count -lt 9) { throw 'Roster emails were not synchronized to Google Access.' }

Write-Host 'Creating, updating, joining, electing, locking and registering a topic through real APIs...'
$logins = @()
foreach ($row in $students) {
    $logins += Invoke-Api 'POST' '/api/auth/login' @{ email = $row.email; password = $studentPassword } $null
}
$group = Invoke-Api 'POST' '/api/groups' @{ groupName = "Flow team $suffix"; semesterCode = $code } $logins[0].token
$group = Invoke-Api 'PUT' "/api/groups/$($group.id)" @{ groupName = "Flow team $suffix updated" } $logins[0].token
1..3 | ForEach-Object { Invoke-Api 'POST' "/api/groups/$($group.id)/members" $null $logins[$_].token | Out-Null }
$leaderStudentId = $logins[0].student.id
0..2 | ForEach-Object { Invoke-Api 'POST' "/api/groups/$($group.id)/vote-leader" @{ nominatedStudentId = $leaderStudentId } $logins[$_].token | Out-Null }
$group = Invoke-Api 'POST' "/api/groups/$($group.id)/lock" $null $logins[0].token
if ($group.status -ne 2 -and $group.status -ne 'Locked') { throw 'Group was not locked.' }
$group = Invoke-Api 'POST' "/api/groups/$($group.id)/topic" @{ topicTitle = "Real API topic $suffix" } $logins[0].token
if (-not $group.topicRegisteredAt) { throw 'Topic registration was not persisted.' }

# Exercise group delete independently with an open one-person group.
$transientGroup = Invoke-Api 'POST' '/api/groups' @{ groupName = "Transient $suffix"; semesterCode = $code } $logins[4].token
Invoke-Api 'DELETE' "/api/groups/$($transientGroup.id)" $null $logins[4].token | Out-Null

# Wait for the outbox + Kafka consumer to project group membership to IdentitySemester.
$deadline = [datetime]::UtcNow.AddSeconds(45)
do {
    Start-Sleep -Seconds 2
    $unmatched = Invoke-Api 'GET' "/api/students?semesterCode=$code&hasGroup=false&page=1&pageSize=50&sortBy=code" $null $adminToken
} while ($unmatched.totalCount -ne 5 -and [datetime]::UtcNow -lt $deadline)
if ($unmatched.totalCount -ne 5) { throw "Membership projection did not settle; expected 5 unmatched students, found $($unmatched.totalCount)." }

# Close free registration while keeping topic registration open, then test random matching.
Invoke-Api 'PUT' "/api/semesters/$($semester.id)" @{
    name = $semester.name; startDate = $semester.startDate; endDate = $semester.endDate; isActive = $true
    registrationDeadline = Utc($now.AddMinutes(-5)); topicDeadline = Utc($now.AddDays(21)); mentorDeadline = Utc($now.AddDays(30))
} $adminToken | Out-Null
$matching = Invoke-Api 'POST' "/api/matching/random?semesterCode=$code" $null $adminToken
if ($matching.matchedStudents -ne 5) { throw "Random matching expected 5 students, matched $($matching.matchedStudents)." }

$groups = Invoke-Api 'GET' "/api/groups?semesterCode=$code&page=1&pageSize=50" $null $adminToken
if ($groups.totalCount -lt 2) { throw 'Expected the locked group and a random-matched group.' }
Write-Host "SUCCESS: real IdentitySemester and GroupMatching flow completed in PostgreSQL semester $code."
