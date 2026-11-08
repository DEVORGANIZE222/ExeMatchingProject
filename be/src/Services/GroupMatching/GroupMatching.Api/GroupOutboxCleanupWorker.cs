using EXETeamMatching.GroupMatching.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.GroupMatching.Api;

/// <summary>
/// Scheduled maintenance job. It retains recently published events for
/// troubleshooting, then removes only acknowledged outbox rows after retention.
/// It never changes group membership, locking, or matching decisions.
/// </summary>
public sealed class GroupOutboxCleanupWorker(IServiceScopeFactory scopes, IConfiguration configuration,
    ILogger<GroupOutboxCleanupWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        var intervalSeconds = Math.Clamp(configuration.GetValue("Maintenance:OutboxCleanupIntervalSeconds", 60), 30, 3600);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(intervalSeconds));
        await CleanupAsync(stoppingToken);
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await CleanupAsync(stoppingToken);
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        try
        {
            var retentionDays = Math.Clamp(configuration.GetValue("Maintenance:PublishedOutboxRetentionDays", 7), 1, 365);
            var cutoff = DateTime.UtcNow.AddDays(-retentionDays);
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GroupMatchingDbContext>();
            var removed = await db.GroupEventOutbox
                .Where(item => item.PublishedAt != null && item.PublishedAt < cutoff)
                .ExecuteDeleteAsync(ct);
            logger.LogInformation("Group outbox cleanup completed: removed {Count} published events older than {Days} days.", removed, retentionDays);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex) { logger.LogWarning(ex, "Group outbox cleanup failed; it will retry on the next scheduled run."); }
    }
}
