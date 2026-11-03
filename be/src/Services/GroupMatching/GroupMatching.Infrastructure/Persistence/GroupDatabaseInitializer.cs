using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.GroupMatching.Infrastructure.Persistence;

/// <summary>Applies an additive upgrade to an existing EnsureCreated database.</summary>
public sealed class GroupDatabaseInitializer(GroupMatchingDbContext db)
{
    public async Task Initialize(CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        if (!db.Database.IsNpgsql()) return;
        var assembly = typeof(GroupDatabaseInitializer).Assembly;
        using var stream = assembly.GetManifestResourceStream(assembly.GetManifestResourceNames().Single(x => x.EndsWith("group-matching-upgrade.sql")))!;
        using var reader = new StreamReader(stream);
        var sql = await reader.ReadToEndAsync(ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync(sql, ct);
        await transaction.CommitAsync(ct);
    }
}
