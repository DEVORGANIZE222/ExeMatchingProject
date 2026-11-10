using System.Net;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using System.Text.Json;
using EXETeamMatching.Notification.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Notification.Infrastructure.Services;

public class EmailService : IEmailService
{
    public const string BrandLogoContentId = "exematching-logo";
    private static readonly Lazy<byte[]?> EmbeddedLogoBytes = new(LoadEmbeddedLogoBytes);
    private static readonly HttpClient SharedHttpClient = CreateDefaultHttpClient();

    private readonly EmailSettings _settings;
    private readonly ILogger<EmailService> _logger;
    private readonly HttpClient _httpClient;

    public EmailService(IOptions<EmailSettings> settings, ILogger<EmailService> logger)
        : this(settings, logger, SharedHttpClient)
    {
    }

    public EmailService(IOptions<EmailSettings> settings, ILogger<EmailService> logger, HttpClient httpClient)
    {
        _settings = settings.Value;
        _logger = logger;
        _httpClient = httpClient;
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

        bool hasWebhook = !string.IsNullOrWhiteSpace(_settings.WebhookUrl);
        bool hasSmtpCreds = !string.IsNullOrWhiteSpace(_settings.Username)
            && !string.IsNullOrWhiteSpace(_settings.Password)
            && !hasPlaceholderCreds;

        bool isSimulation = _settings.SimulateOnly || (!hasWebhook && !hasSmtpCreds);

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
            if (hasWebhook)
            {
                await SendViaWebhookAsync(to, subject, body, isHtml, cancellationToken);
            }
            else
            {
                await SendViaSmtpAsync(to, subject, body, isHtml, cancellationToken);
            }

            _logger.LogInformation("Email successfully dispatched to {To} with subject '{Subject}'", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To} with subject '{Subject}'", to, subject);
            throw;
        }
    }

    private async Task SendViaWebhookAsync(string to, string subject, string body, bool isHtml, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(_settings.WebhookUrl?.Trim(), UriKind.Absolute, out var webhookUri))
        {
            throw new InvalidOperationException("EmailSettings:WebhookUrl is not a valid absolute URL.");
        }

        var logoBytes = isHtml && body.Contains($"cid:{BrandLogoContentId}", StringComparison.OrdinalIgnoreCase)
            ? EmbeddedLogoBytes.Value
            : null;

        var payload = new
        {
            secret = string.IsNullOrWhiteSpace(_settings.WebhookSecret) ? null : _settings.WebhookSecret,
            to,
            subject,
            body,
            isHtml,
            senderName = _settings.SenderName,
            logoContentId = logoBytes is { Length: > 0 } ? BrandLogoContentId : null,
            logoBase64 = logoBytes is { Length: > 0 } ? Convert.ToBase64String(logoBytes) : null
        };

        using var response = await _httpClient.PostAsJsonAsync(webhookUri, payload, cancellationToken);
        var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Email webhook returned HTTP {(int)response.StatusCode}: {responseText}");
        }

        var mediaType = response.Content.Headers.ContentType?.MediaType;
        var trimmed = responseText.TrimStart();
        if (string.Equals(mediaType, MediaTypeNames.Text.Html, StringComparison.OrdinalIgnoreCase) || trimmed.StartsWith('<'))
        {
            throw new InvalidOperationException("Email webhook returned HTML instead of JSON. Ensure Google Apps Script Web App access is set to 'Anyone'.");
        }

        if (!string.IsNullOrWhiteSpace(trimmed))
        {
            using var doc = JsonDocument.Parse(trimmed);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                if (doc.RootElement.TryGetProperty("ok", out var okProp) && okProp.ValueKind == JsonValueKind.False)
                {
                    var err = doc.RootElement.TryGetProperty("error", out var errProp) ? errProp.GetString() : responseText;
                    throw new InvalidOperationException($"Email webhook reported failure: {err}");
                }

                if (doc.RootElement.TryGetProperty("status", out var statusProp)
                    && string.Equals(statusProp.GetString(), "error", StringComparison.OrdinalIgnoreCase))
                {
                    var msg = doc.RootElement.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : responseText;
                    throw new InvalidOperationException($"Email webhook reported failure: {msg}");
                }
            }
        }
    }

    private async Task SendViaSmtpAsync(string to, string subject, string body, bool isHtml, CancellationToken cancellationToken)
    {
        using var message = new MailMessage
        {
            From = new MailAddress(_settings.SenderEmail, _settings.SenderName),
            Subject = subject,
            IsBodyHtml = isHtml
        };
        message.To.Add(to);

        var logoBytes = EmbeddedLogoBytes.Value;
        if (isHtml && logoBytes is { Length: > 0 }
            && body.Contains($"cid:{BrandLogoContentId}", StringComparison.OrdinalIgnoreCase))
        {
            var htmlView = AlternateView.CreateAlternateViewFromString(body, Encoding.UTF8, MediaTypeNames.Text.Html);
            var logoStream = new MemoryStream(logoBytes, writable: false);
            var logoResource = new LinkedResource(logoStream, "image/png")
            {
                ContentId = BrandLogoContentId,
                TransferEncoding = TransferEncoding.Base64
            };
            logoResource.ContentType.Name = "exematching-logo.png";
            htmlView.LinkedResources.Add(logoResource);
            message.AlternateViews.Add(htmlView);
        }
        else
        {
            message.Body = body;
        }

        using var smtpClient = new SmtpClient(_settings.SmtpServer, _settings.SmtpPort)
        {
            EnableSsl = _settings.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(_settings.Username, _settings.Password),
            Timeout = 10000
        };

        await smtpClient.SendMailAsync(message, cancellationToken);
    }

    private static HttpClient CreateDefaultHttpClient() => new(new HttpClientHandler
    {
        AllowAutoRedirect = true,
        MaxAutomaticRedirections = 5
    })
    {
        Timeout = TimeSpan.FromSeconds(30)
    };

    private static byte[]? LoadEmbeddedLogoBytes()
    {
        var assembly = typeof(EmailService).Assembly;
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(name => name.EndsWith("Assets.logo.png", StringComparison.OrdinalIgnoreCase));
        if (resourceName is null)
            return null;

        using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
            return null;

        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }
}
