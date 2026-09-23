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
    public string PasswordHash { get; set; } = string.Empty;
    public Guid RoleId { get; set; }
    public Role Role { get; set; } = null!;
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
}

public class Semester : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsActive { get; set; } = true;
}
