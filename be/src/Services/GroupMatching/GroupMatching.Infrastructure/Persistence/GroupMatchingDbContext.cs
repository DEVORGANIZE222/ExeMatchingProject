using EXETeamMatching.GroupMatching.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.GroupMatching.Infrastructure.Persistence;

public class GroupMatchingDbContext(DbContextOptions<GroupMatchingDbContext> options) : DbContext(options)
{

    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<LeaderVote> LeaderVotes => Set<LeaderVote>();
    public DbSet<GroupEventOutbox> GroupEventOutbox => Set<GroupEventOutbox>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasIndex(x => x.GroupCode).IsUnique();
            entity.Property(x => x.GroupCode).HasMaxLength(64).IsRequired();
            entity.Property(x => x.GroupName).HasMaxLength(120).IsRequired();
            entity.Property(x => x.SemesterCode).HasMaxLength(30).IsRequired();
            entity.Property(x => x.TopicTitle).HasMaxLength(300);
            entity.HasMany(x => x.Members).WithOne(x => x.Group).HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(x => x.Votes).WithOne().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.HasIndex(x => new { x.GroupId, x.StudentId }).IsUnique();
            entity.HasIndex(x => x.StudentId).IsUnique();
            entity.Property(x => x.StudentCode).HasMaxLength(30).IsRequired();
            entity.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        });
        modelBuilder.Entity<LeaderVote>(entity => entity.HasIndex(x => new { x.GroupId, x.VoterStudentId }).IsUnique());
        modelBuilder.Entity<GroupEventOutbox>(entity =>
        {
            entity.HasIndex(x => x.PublishedAt);
            entity.Property(x => x.Topic).HasMaxLength(80).IsRequired();
            entity.Property(x => x.Payload).HasColumnType("jsonb").IsRequired();
        });
    }
}
