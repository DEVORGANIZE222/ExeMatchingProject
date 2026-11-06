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
    public DbSet<StudentEventOutbox> StudentEventOutbox => Set<StudentEventOutbox>();
    public DbSet<GoogleAllowedEmail> GoogleAllowedEmails => Set<GoogleAllowedEmail>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<User>().HasIndex(u => u.GoogleSubject).IsUnique();
        modelBuilder.Entity<GoogleAllowedEmail>().HasIndex(x => x.Email).IsUnique();
        modelBuilder.Entity<Role>().HasIndex(r => r.Name).IsUnique();
        modelBuilder.Entity<Semester>().HasIndex(s => s.Code).IsUnique();
        modelBuilder.Entity<Student>().HasIndex(s => new { s.SemesterId, s.StudentCode }).IsUnique();
        modelBuilder.Entity<Student>().HasIndex(s => new { s.SemesterId, s.UserId }).IsUnique();
        modelBuilder.Entity<Student>().HasOne(s => s.Semester).WithMany().HasForeignKey(s => s.SemesterId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<User>().Property(u => u.TokenVersion).IsConcurrencyToken();

        // Seed Roles
        var adminRoleId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var studentRoleId = Guid.Parse("22222222-2222-2222-2222-222222222222");

        modelBuilder.Entity<Role>().HasData(
            new Role { Id = adminRoleId, Name = "Admin", Description = "System Administrator", CreatedAt = DateTime.UtcNow },
            new Role { Id = studentRoleId, Name = "Student", Description = "Student User", CreatedAt = DateTime.UtcNow }
        );

    }
}
