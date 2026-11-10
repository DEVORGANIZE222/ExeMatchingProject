using System.Text.Json;
using Confluent.Kafka;
using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.Messaging.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Messaging.Implementations;

public class KafkaEventConsumer : IEventConsumer
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly KafkaSettings _settings;
    private readonly ILogger<KafkaEventConsumer> _logger;

    public KafkaEventConsumer(IOptions<KafkaSettings> settings, ILogger<KafkaEventConsumer> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public Task SubscribeAsync<TEvent>(string topic, Func<TEvent, Task> handler, CancellationToken cancellationToken = default) where TEvent : class
    {
        _logger.LogInformation("Starting subscription to Kafka topic {Topic} with group {GroupId}", topic, _settings.GroupId);

        _ = Task.Run(async () =>
        {
            var config = new ConsumerConfig
            {
                GroupId = _settings.GroupId,
                AutoOffsetReset = AutoOffsetReset.Earliest,
                EnableAutoCommit = false
            };
            KafkaConfigHelper.ApplyTo(config, _settings);

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    using var consumer = new ConsumerBuilder<string, string>(config)
                        .SetErrorHandler((_, e) => _logger.LogWarning("Kafka error on {Topic}: {Reason}", topic, e.Reason))
                        .Build();

                    consumer.Subscribe(topic);

                    while (!cancellationToken.IsCancellationRequested)
                    {
                        var result = consumer.Consume(TimeSpan.FromMilliseconds(500));
                        if (result == null || result.IsPartitionEOF) continue;

                        try
                        {
                            var payload = JsonSerializer.Deserialize<TEvent>(result.Message.Value, JsonOptions);
                            if (payload != null)
                            {
                                await handler(payload);
                            }
                            consumer.Commit(result);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error handling message from topic {Topic}", topic);
                        }
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "KafkaConsumer subscription error on topic {Topic}. Retrying in 5s...", topic);
                    try
                    {
                        await Task.Delay(5000, cancellationToken);
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                    {
                        break;
                    }
                }
            }
        }, cancellationToken);

        return Task.CompletedTask;
    }
}
