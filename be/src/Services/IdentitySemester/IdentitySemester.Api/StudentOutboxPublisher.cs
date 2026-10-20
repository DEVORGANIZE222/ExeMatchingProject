using Confluent.Kafka;
using EXETeamMatching.IdentitySemester.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.IdentitySemester.Api;

// Owns only Service 1 events; Notification consumption belongs to Service 4.
public class StudentOutboxPublisher(IServiceScopeFactory scopes, IConfiguration config, ILogger<StudentOutboxPublisher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue("Outbox:Enabled", true)) return;
        using var producer = new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = config["KafkaSettings:BootstrapServers"],
            EnableIdempotence = true, Acks = Acks.All, MessageTimeoutMs = 10000
        }).Build();
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>();
                var pending = await db.StudentEventOutbox.Where(e => e.PublishedAt == null).OrderBy(e => e.CreatedAt).Take(50).ToListAsync(stoppingToken);
                foreach (var item in pending)
                {
                    await producer.ProduceAsync("student-imported", new Message<string, string> { Key = item.Id.ToString(), Value = item.Payload }, stoppingToken);
                    item.PublishedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync(stoppingToken);
                }
                if (pending.Count > 0) logger.LogInformation("Published {Count} student events", pending.Count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning(ex, "Student events remain in the outbox; retrying."); }
            try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
