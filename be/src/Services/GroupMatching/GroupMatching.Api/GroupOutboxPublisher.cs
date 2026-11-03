using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.GroupMatching.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.GroupMatching.Api;

public sealed class GroupOutboxPublisher(IServiceScopeFactory scopes, ILogger<GroupOutboxPublisher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishBatch(stoppingToken);
            }
            catch (Exception ex) { logger.LogWarning(ex, "Unable to publish GroupMatching outbox batch."); }
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
    private async Task PublishBatch(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<GroupMatchingDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IEventPublisher>();
        var entries = await db.GroupEventOutbox.Where(x => x.PublishedAt == null).OrderBy(x => x.CreatedAt).Take(50).ToListAsync(ct);
        foreach (var entry in entries)
        {
            await publisher.PublishRawAsync(entry.Topic, entry.Id.ToString(), entry.Payload, ct);
            entry.PublishedAt = DateTime.UtcNow;
        }
        if (entries.Count > 0) await db.SaveChangesAsync(ct);
    }
}
