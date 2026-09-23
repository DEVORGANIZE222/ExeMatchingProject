using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.Messaging.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Messaging.Implementations;

public class KafkaEventConsumer : IEventConsumer
{
    private readonly KafkaSettings _settings;
    private readonly ILogger<KafkaEventConsumer> _logger;

    public KafkaEventConsumer(IOptions<KafkaSettings> settings, ILogger<KafkaEventConsumer> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public Task SubscribeAsync<TEvent>(string topic, Func<TEvent, Task> handler, CancellationToken cancellationToken = default) where TEvent : class
    {
        _logger.LogInformation("Subscribing to Kafka topic {Topic} with group {GroupId}", topic, _settings.GroupId);
        return Task.CompletedTask;
    }
}
