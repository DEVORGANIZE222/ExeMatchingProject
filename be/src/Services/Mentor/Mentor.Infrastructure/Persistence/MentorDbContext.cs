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

    }
}
