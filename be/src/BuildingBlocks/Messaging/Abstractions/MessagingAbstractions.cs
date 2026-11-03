namespace EXETeamMatching.Messaging.Abstractions;

public interface IEventPublisher
{
    Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class;
    Task PublishAsync<TEvent>(string topic, string key, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class;
    Task PublishRawAsync(string topic, string key, string payload, CancellationToken cancellationToken = default);
}

public interface IEventConsumer
{
    Task SubscribeAsync<TEvent>(string topic, Func<TEvent, Task> handler, CancellationToken cancellationToken = default) where TEvent : class;
}
