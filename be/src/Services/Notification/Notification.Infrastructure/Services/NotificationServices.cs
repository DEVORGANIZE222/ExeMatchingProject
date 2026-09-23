using EXETeamMatching.Notification.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace EXETeamMatching.Notification.Infrastructure.Services;

public class EmailSettings
{
    public string SmtpServer { get; set; } = "smtp.gmail.com";
    public int SmtpPort { get; set; } = 587;
    public string SenderEmail { get; set; } = "noreply@exeteammatching.com";
    public string SenderName { get; set; } = "EXE Team Matching System";
}

public class EmailService : IEmailService
{
    private readonly ILogger<EmailService> _logger;

    public EmailService(ILogger<EmailService> logger)
    {
        _logger = logger;
    }

    public Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending email to {To} with subject '{Subject}'", to, subject);
        return Task.CompletedTask;
    }
}

public class KafkaConsumer : IKafkaConsumer
{
    private readonly ILogger<KafkaConsumer> _logger;
    private readonly INotificationService _notificationService;

    public KafkaConsumer(ILogger<KafkaConsumer> logger, INotificationService notificationService)
    {
        _logger = logger;
        _notificationService = notificationService;
    }

    public Task StartConsumingAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("KafkaConsumer worker initialized. Listening for event topics...");
        return Task.CompletedTask;
    }
}

public class NotificationHandler : INotificationService
{
    private readonly IEmailService _emailService;
    private readonly ILogger<NotificationHandler> _logger;

    public NotificationHandler(IEmailService emailService, ILogger<NotificationHandler> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    public Task HandleEventAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("NotificationHandler processed event: {EventName}", typeof(TEvent).Name);
        return Task.CompletedTask;
    }
}
