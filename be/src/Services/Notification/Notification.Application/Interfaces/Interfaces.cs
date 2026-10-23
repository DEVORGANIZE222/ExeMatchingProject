using EXETeamMatching.Notification.Application.Models;

namespace EXETeamMatching.Notification.Application.Interfaces;

public interface IKafkaConsumer
{
    Task StartConsumingAsync(CancellationToken cancellationToken);
}

public interface INotificationService
{
    Task HandleEventAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default);
    Task HandleEventJsonAsync(string topic, string? key, string payload, CancellationToken cancellationToken = default);
}

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
    Task SendEmailAsync(string to, string subject, string body, bool isHtml, CancellationToken cancellationToken = default);
}

public interface IDeduplicationService
{
    bool TryAcquire(string key);
    bool IsProcessed(string key);
}

public interface INotificationStore
{
    void Record(NotificationRecord record);
    IReadOnlyList<NotificationRecord> GetRecent(int count = 50);
}
