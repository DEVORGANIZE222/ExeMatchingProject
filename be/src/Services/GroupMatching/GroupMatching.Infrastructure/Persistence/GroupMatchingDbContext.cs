using EXETeamMatching.GroupMatching.Domain.Entities;
using EXETeamMatching.GroupMatching.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.GroupMatching.Infrastructure.Persistence;

public class GroupMatchingDbContext : DbContext
{
    public GroupMatchingDbContext(DbContextOptions<GroupMatchingDbContext> options) : base(options) { }

    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<GroupInvitation> GroupInvitations => Set<GroupInvitation>();
    public DbSet<LeaderVote> LeaderVotes => Set<LeaderVote>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var groupId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var leaderStudentId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var member2StudentId = Guid.Parse("77777777-7777-7777-7777-777777777777");

        modelBuilder.Entity<Group>().HasData(
            new Group
            {
                Id = groupId,
                GroupCode = "GRP-FALL26-001",
                GroupName = "Alpha Team EXE",
                TopicTitle = "AI Capstone Matching Platform",
                SemesterCode = "FALL2026",
                Status = GroupStatus.Open,
                LeaderStudentId = leaderStudentId,
                CreatedAt = DateTime.UtcNow
            }
        );

        modelBuilder.Entity<GroupMember>().HasData(
            new GroupMember
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
                GroupId = groupId,
                StudentId = leaderStudentId,
                StudentCode = "SE160001",
                FullName = "Nguyen Van A",
                Role = MemberRole.Leader,
                JoinedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            },
            new GroupMember
            {
                Id = Guid.Parse("99999999-9999-9999-9999-999999999999"),
                GroupId = groupId,
                StudentId = member2StudentId,
                StudentCode = "SE160002",
                FullName = "Tran Van B",
                Role = MemberRole.Member,
                JoinedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            }
        );

        modelBuilder.Entity<LeaderVote>().HasData(
            new LeaderVote
            {
                Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                GroupId = groupId,
                VoterStudentId = member2StudentId,
                NominatedStudentId = leaderStudentId,
                VotedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            }
        );
    }
}
