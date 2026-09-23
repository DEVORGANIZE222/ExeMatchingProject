namespace EXETeamMatching.IdentitySemester.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, string RefreshToken, DateTime Expiration, StudentResponse? Student);

public record StudentResponse(
    Guid Id,
    Guid UserId,
    string StudentCode,
    string FullName,
    string Email,
    string Major,
    string SemesterCode,
    bool HasGroup
);

public record ImportStudentsRequest(string SemesterCode, List<StudentImportDto> Students);

public record StudentImportDto(string StudentCode, string FullName, string Email, string Major);

public record SemesterDto(Guid Id, string Code, string Name, DateTime StartDate, DateTime EndDate, bool IsActive);

public record CreateSemesterRequest(string Code, string Name, DateTime StartDate, DateTime EndDate);
