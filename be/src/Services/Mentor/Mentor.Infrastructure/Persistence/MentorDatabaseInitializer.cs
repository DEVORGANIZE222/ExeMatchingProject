using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.Mentor.Infrastructure.Persistence;

/// <summary>Ensures the Mentor database exists and applies idempotent additive upgrades inside a transaction.</summary>
public sealed class MentorDatabaseInitializer(MentorDbContext db)
{
    public async Task Initialize(CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        if (!db.Database.IsNpgsql())
            return;

        var assembly = typeof(MentorDatabaseInitializer).Assembly;
        using var stream = assembly.GetManifestResourceStream(
            assembly.GetManifestResourceNames().Single(n => n.EndsWith("mentor-upgrade.sql", StringComparison.Ordinal)))!;
        using var reader = new StreamReader(stream);
        var sql = await reader.ReadToEndAsync(ct);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync(sql, ct);
        await transaction.CommitAsync(ct);
    }
}

