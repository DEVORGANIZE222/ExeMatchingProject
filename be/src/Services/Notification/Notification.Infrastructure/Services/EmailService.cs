using System.Net;
using System.Net.Mail;
using EXETeamMatching.Notification.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Notification.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly EmailSettings _settings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<EmailSettings> settings, ILogger<EmailService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        return SendEmailAsync(to, subject, body, isHtml: true, cancellationToken);
    }

    public async Task SendEmailAsync(string to, string subject, string body, bool isHtml, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(to))
        {
            _logger.LogWarning("Cannot send email: recipient address is empty.");
            return;
        }

        bool hasPlaceholderCreds =
            (!string.IsNullOrWhiteSpace(_settings.Username) && _settings.Username.StartsWith("your_", StringComparison.OrdinalIgnoreCase)) ||
            (!string.IsNullOrWhiteSpace(_settings.Password) && _settings.Password.StartsWith("your_", StringComparison.OrdinalIgnoreCase));

        bool isSimulation = _settings.SimulateOnly
            || string.IsNullOrWhiteSpace(_settings.Username)
            || string.IsNullOrWhiteSpace(_settings.Password)
            || hasPlaceholderCreds;

        if (isSimulation)
        {
            _logger.LogInformation(
                "[EMAIL SIMULATED] To: {To} | Subject: {Subject} | Sender: {SenderName} <{SenderEmail}> | HTML: {IsHtml}\nBody Preview: {BodyPreview}",
                to,
                subject,
                _settings.SenderName,
                _settings.SenderEmail,
                isHtml,
                body.Length > 200 ? body[..200] + "..." : body);
            return;
        }

        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
                Subject = subject,
                Body = body,
                IsBodyHtml = isHtml
            };
            message.To.Add(to);

            using var smtpClient = new SmtpClient(_settings.SmtpServer, _settings.SmtpPort)
            {
                EnableSsl = _settings.EnableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_settings.Username, _settings.Password),
                Timeout = 10000
            };

            await smtpClient.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Email successfully dispatched to {To} with subject '{Subject}'", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To} with subject '{Subject}'", to, subject);
            throw;
        }
    }
}
