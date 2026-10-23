using Confluent.Kafka;
using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.Notification.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Notification.Infrastructure.Services;

public class KafkaConsumer : IKafkaConsumer
{
    private static readonly string[] Topics =
    [
        "student-imported",
        "group-created",
        "group-locked",
        "leader-elected",
        "topic-registered",
        "mentor-requested",
        "mentor-decision"
    ];

    private readonly KafkaSettings _settings;
    private readonly INotificationService _notificationService;
    private readonly IDeduplicationService _deduplicationService;
    private readonly ILogger<KafkaConsumer> _logger;

    public KafkaConsumer(
        IOptions<KafkaSettings> settings,
        INotificationService notificationService,
        IDeduplicationService deduplicationService,
        ILogger<KafkaConsumer> logger)
    {
        _settings = settings.Value;
        _notificationService = notificationService;
        _deduplicationService = deduplicationService;
        _logger = logger;
    }

    public async Task StartConsumingAsync(CancellationToken cancellationToken)
    {
        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers = _settings.BootstrapServers,
            GroupId = _settings.GroupId,
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false,
            EnableAutoOffsetStore = false,
            SessionTimeoutMs = 10000,
            MaxPollIntervalMs = 300000
        };

        _logger.LogInformation(
            "KafkaConsumer initializing with BootstrapServers={BootstrapServers}, GroupId={GroupId}",
            _settings.BootstrapServers,
            _settings.GroupId);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                using var consumer = new ConsumerBuilder<string, string>(consumerConfig)
                    .SetErrorHandler((_, e) => _logger.LogWarning("Kafka error: {Reason} (code: {Code})", e.Reason, e.Code))
                    .Build();

                consumer.Subscribe(Topics);
                _logger.LogInformation("KafkaConsumer subscribed to topics: {Topics}", string.Join(", ", Topics));

                while (!cancellationToken.IsCancellationRequested)
                {
                    try
                    {
                        var consumeResult = consumer.Consume(TimeSpan.FromMilliseconds(500));
                        if (consumeResult == null || consumeResult.IsPartitionEOF)
                        {
                            continue;
                        }

                        var message = consumeResult.Message;
                        var topic = consumeResult.Topic;
                        var key = message.Key;
                        var value = message.Value;

                        _logger.LogInformation(
                            "Consumed message from {Topic} [P{Partition} @{Offset}] (Key: {Key})",
                            topic,
                            consumeResult.Partition.Value,
                            consumeResult.Offset.Value,
                            key);

                        var dedupKey = string.IsNullOrWhiteSpace(key)
                            ? $"{topic}_{consumeResult.Partition.Value}_{consumeResult.Offset.Value}"
                            : key;

                        if (!_deduplicationService.TryAcquire(dedupKey))
                        {
                            _logger.LogInformation("Skipping duplicate message key: {DedupKey}", dedupKey);
                            consumer.Commit(consumeResult);
                            continue;
                        }

                        await _notificationService.HandleEventJsonAsync(topic, key, value, cancellationToken);
                        consumer.Commit(consumeResult);
                    }
                    catch (ConsumeException ex)
                    {
                        _logger.LogWarning(ex, "Kafka consume error: {Reason}", ex.Error.Reason);
                    }
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation("KafkaConsumer stopped due to cancellation.");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "KafkaConsumer encountered a connection failure. Retrying in 5 seconds...");
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
    }
}
