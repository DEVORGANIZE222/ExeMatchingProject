using EXETeamMatching.SharedKernel.Domain;

namespace EXETeamMatching.IdentitySemester.Domain.Entities;

public class Role : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class User : BaseEntity
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? GoogleSubject { get; set; }
    public string? GooglePictureUrl { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public int TokenVersion { get; set; }
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;
}

public class StudentEventOutbox : BaseEntity
{
    public string Topic { get; set; } = "student-imported";
    public string Payload { get; set; } = string.Empty;
    public DateTime? PublishedAt { get; set; }
}

public class GoogleAllowedEmail : BaseEntity
{
    public string Email { get; set; } = string.Empty;
}

public class Student : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string StudentCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Major { get; set; } = string.Empty;
    public Guid SemesterId { get; set; }
    public Semester Semester { get; set; } = null!;
    public bool HasGroup { get; set; } = false;
    public List<StudentStrengthRole> StrengthRoles { get; set; } = new();
}

/// <summary>Professional strengths selected by a student; not an authorization role.</summary>
public class StudentStrengthRole : BaseEntity
{
    public Guid StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public string RoleCode { get; set; } = string.Empty;
}

public class Semester : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? RegistrationDeadline { get; set; }
    public DateTime? TopicDeadline { get; set; }
    public DateTime? MentorDeadline { get; set; }
}
