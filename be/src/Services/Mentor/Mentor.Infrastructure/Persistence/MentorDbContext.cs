using EXETeamMatching.Mentor.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.Mentor.Infrastructure.Persistence;

public class MentorDbContext : DbContext
{
    public MentorDbContext(DbContextOptions<MentorDbContext> options) : base(options) { }

    public DbSet<MentorUser> Mentors => Set<MentorUser>();
    public DbSet<MentorQuota> MentorQuotas => Set<MentorQuota>();
    public DbSet<MentorRequest> MentorRequests => Set<MentorRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var mentorId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var userId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

        modelBuilder.Entity<MentorUser>().HasData(
            new MentorUser
            {
                Id = mentorId,
                UserId = userId,
                FullName = "Dr. Le Van C",
                Email = "clevan@fpt.edu.vn",
                Department = "Software Engineering",
                Expertise = "AI, Microservices, Cloud Computing",
                CreatedAt = DateTime.UtcNow
            }
        );

        modelBuilder.Entity<MentorQuota>().HasData(
            new MentorQuota
            {
                Id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                MentorId = mentorId,
                MaxQuota = 5,
                CurrentAssigned = 1,
                CreatedAt = DateTime.UtcNow
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
