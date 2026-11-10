using System.Text.Json;
using Confluent.Kafka;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.GroupMatching.Infrastructure.Persistence;
using EXETeamMatching.Messaging.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.GroupMatching.Api;

/// <summary>
/// Applies an IdentitySemester rename without sharing databases. The update is
/// idempotent: replaying the same Kafka message finds no remaining old code.
/// </summary>
public sealed class SemesterCodeChangedConsumer(IServiceScopeFactory scopes, IOptions<KafkaSettings> settings,
    IConfiguration configuration, ILogger<SemesterCodeChangedConsumer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        var config = new ConsumerConfig
        {
            GroupId = "group-matching-semester-code-sync",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };
        KafkaConfigHelper.ApplyTo(config, KafkaConfigHelper.Resolve(configuration, settings.Value));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<string, string>(config).Build();
                consumer.Subscribe("semester-code-changed");
                while (!stoppingToken.IsCancellationRequested)
                {
                    var result = consumer.Consume(TimeSpan.FromMilliseconds(500));
                    if (result is null) continue;
                    var message = JsonSerializer.Deserialize<SemesterCodeChangedEvent>(result.Message.Value);
                    if (message is not null)
                    {
                        await using var scope = scopes.CreateAsyncScope();
                        var db = scope.ServiceProvider.GetRequiredService<GroupMatchingDbContext>();
                        var updated = await db.Groups.Where(group => group.SemesterCode == message.OldSemesterCode)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(group => group.SemesterCode, message.NewSemesterCode)
                                .SetProperty(group => group.UpdatedAt, DateTime.UtcNow), stoppingToken);
                        logger.LogInformation("Semester code synchronization {OldCode} -> {NewCode} updated {Count} groups.",
                            message.OldSemesterCode, message.NewSemesterCode, updated);
                    }
                    consumer.Commit(result);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "GroupMatching semester-code consumer failed; retrying in 5 seconds.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }
}
