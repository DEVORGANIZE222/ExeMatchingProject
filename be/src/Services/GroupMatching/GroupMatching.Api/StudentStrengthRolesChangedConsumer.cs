using System.Text.Json;
using Confluent.Kafka;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.GroupMatching.Infrastructure.Persistence;
using EXETeamMatching.Messaging.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.GroupMatching.Api;

/// <summary>
/// Synchronizes student Core/strength roles into group_matching_db when updated in IdentitySemester.
/// Idempotent and non-blocking on startup.
/// </summary>
public sealed class StudentStrengthRolesChangedConsumer(
    IServiceScopeFactory scopes,
    IOptions<KafkaSettings> settings,
    IConfiguration configuration,
    ILogger<StudentStrengthRolesChangedConsumer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        var config = new ConsumerConfig
        {
            BootstrapServers = configuration["KafkaSettings:BootstrapServers"] ?? settings.Value.BootstrapServers,
            GroupId = "group-matching-student-roles-sync",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<string, string>(config).Build();
                consumer.Subscribe("student-strength-roles-changed");
                while (!stoppingToken.IsCancellationRequested)
                {
                    var result = consumer.Consume(TimeSpan.FromMilliseconds(500));
                    if (result is null) continue;
                    var message = JsonSerializer.Deserialize<StudentStrengthRolesChangedEvent>(result.Message.Value);
                    if (message is not null)
                    {
                        var serialized = string.Join(',', (message.RoleCodes ?? [])
                            .Where(r => !string.IsNullOrWhiteSpace(r))
                            .Select(r => r.Trim())
                            .Distinct(StringComparer.OrdinalIgnoreCase));
                        if (serialized.Length > 200)
                            serialized = serialized[..200];

                        await using var scope = scopes.CreateAsyncScope();
                        var db = scope.ServiceProvider.GetRequiredService<GroupMatchingDbContext>();
                        var updated = await db.GroupMembers
                            .Where(member => member.StudentId == message.StudentId)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(member => member.StrengthRoles, serialized)
                                .SetProperty(member => member.UpdatedAt, DateTime.UtcNow), stoppingToken);
                        logger.LogInformation(
                            "Strength role sync for StudentId {StudentId} updated {Count} group member rows.",
                            message.StudentId, updated);
                    }
                    consumer.Commit(result);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "GroupMatching student-roles consumer failed; retrying in 5 seconds.");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }
}

