using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.Messaging.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Messaging.Implementations;

public class KafkaEventPublisher : IEventPublisher
{
    private readonly KafkaSettings _settings;
    private readonly ILogger<KafkaEventPublisher> _logger;

    public KafkaEventPublisher(IOptions<KafkaSettings> settings, ILogger<KafkaEventPublisher> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class
    {
        _logger.LogInformation("Publishing event {EventName} to Kafka topic {Topic} at {BootstrapServers}", typeof(TEvent).Name, topic, _settings.BootstrapServers);
        return Task.CompletedTask;
    }
}
