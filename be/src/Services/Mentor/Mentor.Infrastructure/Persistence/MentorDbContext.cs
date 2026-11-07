using EXETeamMatching.Mentor.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.Mentor.Infrastructure.Persistence;

public class MentorDbContext : DbContext
{
    public MentorDbContext(DbContextOptions<MentorDbContext> options) : base(options) { }

    public DbSet<MentorUser> Mentors => Set<MentorUser>();
    public DbSet<MentorQuota> MentorQuotas => Set<MentorQuota>();
    public DbSet<MentorRequest> MentorRequests => Set<MentorRequest>();
    public DbSet<MentorGroupProgress> MentorGroupProgress => Set<MentorGroupProgress>();
    public DbSet<MentorAppointment> MentorAppointments => Set<MentorAppointment>();
    public DbSet<MentorNotification> MentorNotifications => Set<MentorNotification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<MentorUser>().HasIndex(x => x.UserId).IsUnique();
        modelBuilder.Entity<MentorQuota>().HasIndex(x => x.MentorId).IsUnique();
        modelBuilder.Entity<MentorRequest>().HasIndex(x => x.GroupId).HasFilter("\"Status\" = 0").IsUnique();
        modelBuilder.Entity<MentorUser>().Property(x => x.Phone).HasMaxLength(40);
        modelBuilder.Entity<MentorGroupProgress>().HasIndex(x => new { x.MentorId, x.GroupId }).IsUnique();
        modelBuilder.Entity<MentorGroupProgress>().Property(x => x.GroupName).HasMaxLength(200);
        modelBuilder.Entity<MentorGroupProgress>().Property(x => x.Topic).HasMaxLength(1000);
        modelBuilder.Entity<MentorGroupProgress>().Property(x => x.Milestone).HasMaxLength(200);
        modelBuilder.Entity<MentorGroupProgress>().Property(x => x.Feedback).HasMaxLength(2000);
        modelBuilder.Entity<MentorAppointment>().Property(x => x.Title).HasMaxLength(200);
        modelBuilder.Entity<MentorAppointment>().Property(x => x.Notes).HasMaxLength(2000);
        modelBuilder.Entity<MentorNotification>().Property(x => x.Type).HasMaxLength(40);
        modelBuilder.Entity<MentorNotification>().Property(x => x.Title).HasMaxLength(200);
        modelBuilder.Entity<MentorNotification>().Property(x => x.Message).HasMaxLength(1000);

        var mentorId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var userId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var mentorDangHungId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var userDangHungId = Guid.Parse("88888888-8888-8888-8888-888888888888");

        modelBuilder.Entity<MentorUser>().HasData(
            new MentorUser
            {
                Id = mentorId,
                UserId = userId,
                FullName = "Dr. Le Van C",
                Email = "clevan@fpt.edu.vn",
                Department = "Software Engineering",
                Expertise = "AI, Microservices, Cloud Computing",
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new MentorUser
            {
                Id = mentorDangHungId,
                UserId = userDangHungId,
                FullName = "ThS. Đặng Hùng (Mentor)",
                Email = "danghung25022005@gmail.com",
                Department = "Software Engineering",
                Expertise = "EXE Capstone, AI, Fullstack & Mobile Architecture",
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<MentorQuota>().HasData(
            new MentorQuota
            {
                Id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                MentorId = mentorId,
                MaxQuota = 5,
                CurrentAssigned = 1,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new MentorQuota
            {
                Id = Guid.Parse("99999999-9999-9999-9999-999999999999"),
                MentorId = mentorDangHungId,
                MaxQuota = 5,
                CurrentAssigned = 0,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        modelBuilder.Entity<MentorRequest>().HasData(
            new MentorRequest
            {
                Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                GroupId = Guid.Parse("66666666-6666-6666-6666-666666666666"),
                MentorId = mentorId,
                Message = "Dear Dr. Le Van C, we would love to have you as our EXE mentor.",
                Status = RequestStatus.Pending,
                CreatedAt = DateTime.UtcNow
            }
        );
    }
}
