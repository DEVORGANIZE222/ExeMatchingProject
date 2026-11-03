using System.Text.Json;
using Confluent.Kafka;
using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.Messaging.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Messaging.Implementations;

public class KafkaEventPublisher : IEventPublisher, IDisposable
{
    private readonly KafkaSettings _settings;
    private readonly ILogger<KafkaEventPublisher> _logger;
    private readonly Lazy<IProducer<string, string>> _producer;

    public KafkaEventPublisher(IOptions<KafkaSettings> settings, ILogger<KafkaEventPublisher> logger)
    {
        _settings = settings.Value;
        _logger = logger;
        _producer = new Lazy<IProducer<string, string>>(() =>
        {
            var config = new ProducerConfig
            {
                BootstrapServers = _settings.BootstrapServers,
                Acks = Acks.All,
                MessageTimeoutMs = 10000,
                EnableIdempotence = true
            };
            return new ProducerBuilder<string, string>(config).Build();
        });
    }

    public async Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class
        => await PublishAsync(topic, Guid.NewGuid().ToString(), @event, cancellationToken);

    public async Task PublishAsync<TEvent>(string topic, string key, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class
    {
        if (@event == null) return;

        var eventName = typeof(TEvent).Name;
        _logger.LogInformation("Publishing event {EventName} to Kafka topic {Topic} at {BootstrapServers}", eventName, topic, _settings.BootstrapServers);

        try
        {
            await PublishRawAsync(topic, key, JsonSerializer.Serialize(@event), cancellationToken);
            _logger.LogInformation("Successfully published event {EventName} to Kafka topic {Topic}", eventName, topic);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish event {EventName} to Kafka topic {Topic}", eventName, topic);
            throw;
        }
    }

    public async Task PublishRawAsync(string topic, string key, string payload, CancellationToken cancellationToken = default)
    {
        var message = new Message<string, string> { Key = key, Value = payload };
        await _producer.Value.ProduceAsync(topic, message, cancellationToken);
    }

    public void Dispose()
    {
        if (_producer.IsValueCreated)
        {
            try
            {
                _producer.Value.Flush(TimeSpan.FromSeconds(5));
                _producer.Value.Dispose();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error disposing Kafka producer.");
            }
        }
    }
}
