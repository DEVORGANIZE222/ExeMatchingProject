using System.Text.Json;
using Confluent.Kafka;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.IdentitySemester.Infrastructure.Persistence;
using EXETeamMatching.Messaging.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.IdentitySemester.Api;

/// <summary>
/// IdentitySemester remains the owner of Students.HasGroup.  GroupMatching only
/// emits an idempotent state-change event and never writes identity_db.
/// </summary>
public sealed class GroupMembershipConsumer(IServiceScopeFactory scopes, IOptions<KafkaSettings> settings, IConfiguration configuration, ILogger<GroupMembershipConsumer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Do not let initial Kafka metadata discovery delay Kestrel startup.
        // The worker retries independently while the API is already available.
        await Task.Yield();
        var config = new ConsumerConfig
        {
            BootstrapServers = configuration["KafkaSettings:BootstrapServers"] ?? settings.Value.BootstrapServers,
            GroupId = "identity-semester-group-state-sync",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<string, string>(config).Build();
                consumer.Subscribe("student-group-membership-changed");
                while (!stoppingToken.IsCancellationRequested)
                {
                    var result = consumer.Consume(TimeSpan.FromMilliseconds(500));
                    if (result is null) continue;
                    var message = JsonSerializer.Deserialize<StudentGroupMembershipChangedEvent>(result.Message.Value);
                    if (message is null) { consumer.Commit(result); continue; }
                    await using var scope = scopes.CreateAsyncScope();
                    var db = scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>();
                    var student = await db.Students.SingleOrDefaultAsync(x => x.Id == message.StudentId, stoppingToken);
                    if (student is not null && student.HasGroup != message.HasGroup)
                    {
                        student.HasGroup = message.HasGroup;
                        student.UpdatedAt = DateTime.UtcNow;
                        await db.SaveChangesAsync(stoppingToken);
                    }
                    consumer.Commit(result);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Identity group-state consumer failed; retrying in 5 seconds.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }
}
