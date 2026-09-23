namespace EXETeamMatching.Notification.Application.Interfaces;

public interface IKafkaConsumer
{
    Task StartConsumingAsync(CancellationToken cancellationToken);
}

public interface INotificationService
{
    Task HandleEventAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default);
}

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
}
