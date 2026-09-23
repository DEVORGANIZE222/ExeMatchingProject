namespace EXETeamMatching.Messaging.Abstractions;

public interface IEventPublisher
{
    Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class;
}

public interface IEventConsumer
{
    Task SubscribeAsync<TEvent>(string topic, Func<TEvent, Task> handler, CancellationToken cancellationToken = default) where TEvent : class;
}
