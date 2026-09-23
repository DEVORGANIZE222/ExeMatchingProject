using EXETeamMatching.IdentitySemester.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Persistence;

public class IdentitySemesterDbContext : DbContext
{
    public IdentitySemesterDbContext(DbContextOptions<IdentitySemesterDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Semester> Semesters => Set<Semester>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Seed Roles
        var adminRoleId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var studentRoleId = Guid.Parse("22222222-2222-2222-2222-222222222222");

        modelBuilder.Entity<Role>().HasData(
            new Role { Id = adminRoleId, Name = "Admin", Description = "System Administrator", CreatedAt = DateTime.UtcNow },
            new Role { Id = studentRoleId, Name = "Student", Description = "Student User", CreatedAt = DateTime.UtcNow }
        );

        // Seed Active Semester
        var semesterId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        modelBuilder.Entity<Semester>().HasData(
            new Semester
            {
                Id = semesterId,
                Code = "FALL2026",
                Name = "Fall Semester 2026",
                StartDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }
        );

        // Seed Demo Users
        var studentUserId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        modelBuilder.Entity<User>().HasData(
            new User
            {
                Id = studentUserId,
                Username = "student01",
                Email = "student01@fpt.edu.vn",
                PasswordHash = "AQAAAAEAACcQAAAAEHhashedpassword...",
                RoleId = studentRoleId,
                CreatedAt = DateTime.UtcNow
            }
        );

        // Seed Demo Student
        modelBuilder.Entity<Student>().HasData(
            new Student
            {
                Id = Guid.Parse("55555555-5555-5555-5555-555555555555"),
                UserId = studentUserId,
                StudentCode = "SE160001",
                FullName = "Nguyen Van A",
                Major = "Software Engineering",
                SemesterId = semesterId,
                HasGroup = false,
                CreatedAt = DateTime.UtcNow
            }
        );
    }
}
