using System.Text.Json;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.Notification.Application.Interfaces;
using EXETeamMatching.Notification.Application.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.Notification.Infrastructure.Services;

public class NotificationHandler : INotificationService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IEmailService _emailService;
    private readonly INotificationStore _store;
    private readonly EmailSettings _emailSettings;
    private readonly ILogger<NotificationHandler> _logger;

    public NotificationHandler(
        IEmailService emailService,
        INotificationStore store,
        IOptions<EmailSettings> emailSettings,
        ILogger<NotificationHandler> logger)
    {
        _emailService = emailService;
        _store = store;
        _emailSettings = emailSettings?.Value ?? new EmailSettings();
        _logger = logger;
    }

    public NotificationHandler(
        IEmailService emailService,
        INotificationStore store,
        ILogger<NotificationHandler> logger)
        : this(emailService, store, Options.Create(new EmailSettings()), logger)
    {
    }

    public async Task HandleEventAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
    {
        if (@event == null) return;

        switch (@event)
        {
            case StudentImportedEvent studentEvent:
                await ProcessStudentImportedAsync(studentEvent, null, cancellationToken);
                break;
            case GroupCreatedEvent groupCreated:
                await ProcessGroupCreatedAsync(groupCreated, null, cancellationToken);
                break;
            case GroupLockedEvent groupLocked:
                await ProcessGroupLockedAsync(groupLocked, null, cancellationToken);
                break;
            case LeaderElectedEvent leaderElected:
                await ProcessLeaderElectedAsync(leaderElected, null, cancellationToken);
                break;
            case TopicRegisteredEvent topicRegistered:
                await ProcessTopicRegisteredAsync(topicRegistered, null, cancellationToken);
                break;
            case MentorRequestedEvent mentorRequested:
                await ProcessMentorRequestedAsync(mentorRequested, null, cancellationToken);
                break;
            case MentorDecisionEvent mentorDecision:
                await ProcessMentorDecisionAsync(mentorDecision, null, cancellationToken);
                break;
            default:
                _logger.LogInformation("Unhandled event type: {Type}", typeof(TEvent).Name);
                break;
        }
    }

    public async Task HandleEventJsonAsync(string topic, string? key, string payload, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Processing event from topic '{Topic}' with key '{Key}'", topic, key);

        try
        {
            switch (topic.Trim().ToLowerInvariant())
            {
                case "student-imported":
                    var studentEvent = JsonSerializer.Deserialize<StudentImportedEvent>(payload, JsonOptions);
                    if (studentEvent != null)
                    {
                        await ProcessStudentImportedAsync(studentEvent, key, cancellationToken);
                    }
                    break;

                case "group-created":
                    var groupCreated = JsonSerializer.Deserialize<GroupCreatedEvent>(payload, JsonOptions);
                    if (groupCreated != null)
                    {
                        await ProcessGroupCreatedAsync(groupCreated, key, cancellationToken);
                    }
                    break;

                case "group-locked":
                    var groupLocked = JsonSerializer.Deserialize<GroupLockedEvent>(payload, JsonOptions);
                    if (groupLocked != null)
                    {
                        await ProcessGroupLockedAsync(groupLocked, key, cancellationToken);
                    }
                    break;

                case "leader-elected":
                    var leaderElected = JsonSerializer.Deserialize<LeaderElectedEvent>(payload, JsonOptions);
                    if (leaderElected != null)
                    {
                        await ProcessLeaderElectedAsync(leaderElected, key, cancellationToken);
                    }
                    break;

                case "topic-registered":
                    var topicRegistered = JsonSerializer.Deserialize<TopicRegisteredEvent>(payload, JsonOptions);
                    if (topicRegistered != null)
                    {
                        await ProcessTopicRegisteredAsync(topicRegistered, key, cancellationToken);
                    }
                    break;

                case "mentor-requested":
                    var mentorRequested = JsonSerializer.Deserialize<MentorRequestedEvent>(payload, JsonOptions);
                    if (mentorRequested != null)
                    {
                        await ProcessMentorRequestedAsync(mentorRequested, key, cancellationToken);
                    }
                    break;

                case "mentor-decision":
                    var mentorDecision = JsonSerializer.Deserialize<MentorDecisionEvent>(payload, JsonOptions);
                    if (mentorDecision != null)
                    {
                        await ProcessMentorDecisionAsync(mentorDecision, key, cancellationToken);
                    }
                    break;

                default:
                    _logger.LogWarning("Received message from unrecognized topic '{Topic}'", topic);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deserializing or handling message from topic '{Topic}' with key '{Key}'", topic, key);
            _store.Record(new NotificationRecord
            {
                Topic = topic,
                EventKey = key,
                EventType = topic,
                Recipient = "N/A",
                Subject = "Processing Error",
                Body = payload,
                IsSuccess = false,
                ErrorMessage = ex.Message
            });
        }
    }

    private async Task ProcessStudentImportedAsync(StudentImportedEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[EXE Matching] Chào mừng {@event.FullName} tham gia học kỳ {@event.SemesterCode}";
        var body = $"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                    <h2 style="color: #2b5797;">Hệ Thống Ghép Nhóm Capstone / EXE</h2>
                    <p>Xin chào <strong>{@event.FullName}</strong> (MSSV: <strong>{@event.StudentCode}</strong>),</p>
                    <p>Hồ sơ sinh viên của bạn đã được ghi nhận vào học kỳ <strong>{@event.SemesterCode}</strong>.</p>
                    <div style="background-color: #f8f9fa; border-left: 4px solid #2b5797; padding: 12px; margin: 15px 0;">
                        <ul style="margin: 0; padding-left: 20px;">
                            <li><strong>Mã sinh viên:</strong> {@event.StudentCode}</li>
                            <li><strong>Họ và tên:</strong> {@event.FullName}</li>
                            <li><strong>Học kỳ:</strong> {@event.SemesterCode}</li>
                            <li><strong>Thời gian ghi nhận:</strong> {@event.ImportedAt:yyyy-MM-dd HH:mm:ss} UTC</li>
                        </ul>
                    </div>
                    <p>Vui lòng đăng nhập vào hệ thống để kiểm tra hồ sơ, tìm kiếm nhóm và theo dõi các mốc quan trọng của học kỳ.</p>
                    <p style="margin-top: 30px; font-size: 12px; color: #777;">Email này được gửi tự động từ hệ thống EXE Team Matching System.</p>
                </div>
            </body>
            </html>
            """;

        await SendAndRecordAsync(
            topic: "student-imported",
            eventKey: key ?? @event.StudentId.ToString(),
            eventType: nameof(StudentImportedEvent),
            recipient: @event.Email,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task ProcessGroupCreatedAsync(GroupCreatedEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[EXE Matching] Nhóm {@event.GroupName} (Mã: {@event.GroupCode}) đã được tạo";
        var body = $"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                    <h2 style="color: #2b5797;">Thông Báo Tạo Nhóm Mới</h2>
                    <p>Nhóm <strong>{@event.GroupName}</strong> đã được khởi tạo thành công trên hệ thống.</p>
                    <ul>
                        <li><strong>Mã nhóm:</strong> {@event.GroupCode}</li>
                        <li><strong>Thời gian tạo:</strong> {@event.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC</li>
                    </ul>
                    <p>Các thành viên có thể tham gia vào nhóm hoặc tiến hành bình chọn trưởng nhóm.</p>
                </div>
            </body>
            </html>
            """;

        var recipient = !string.IsNullOrWhiteSpace(@event.CreatorEmail)
            ? @event.CreatorEmail
            : (!string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail) ? _emailSettings.DefaultRecipientEmail : "team@exeteammatching.com");

        await SendAndRecordAsync(
            topic: "group-created",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(GroupCreatedEvent),
            recipient: recipient,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task ProcessGroupLockedAsync(GroupLockedEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[EXE Matching] Nhóm {@event.GroupCode} đã chốt danh sách thành viên";
        var body = $"""
            <div style="font-family: Arial, sans-serif;">
                <h3>Nhóm {@event.GroupCode} Đã Khóa Danh Sách</h3>
                <p>Nhóm đã hoàn thành việc tạo nhóm với <strong>{@event.MemberCount}</strong> thành viên và đã khóa danh sách lúc {@event.LockedAt:yyyy-MM-dd HH:mm:ss} UTC.</p>
            </div>
            """;

        var recipient = !string.IsNullOrWhiteSpace(@event.ContactEmail)
            ? @event.ContactEmail
            : (!string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail) ? _emailSettings.DefaultRecipientEmail : "team@exeteammatching.com");

        await SendAndRecordAsync(
            topic: "group-locked",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(GroupLockedEvent),
            recipient: recipient,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task ProcessLeaderElectedAsync(LeaderElectedEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[EXE Matching] Nhóm {@event.GroupId} đã hoàn tất bầu Trưởng nhóm";
        var body = $"""
            <div style="font-family: Arial, sans-serif;">
                <h3>Thông Báo Kết Quả Bầu Trưởng Nhóm</h3>
                <p>Sinh viên ID <strong>{@event.LeaderStudentId}</strong> đã được bầu làm Trưởng nhóm vào lúc {@event.ElectedAt:yyyy-MM-dd HH:mm:ss} UTC.</p>
            </div>
            """;

        var recipient = !string.IsNullOrWhiteSpace(@event.LeaderEmail)
            ? @event.LeaderEmail
            : (!string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail) ? _emailSettings.DefaultRecipientEmail : "leader@exeteammatching.com");

        await SendAndRecordAsync(
            topic: "leader-elected",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(LeaderElectedEvent),
            recipient: recipient,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task ProcessTopicRegisteredAsync(TopicRegisteredEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[EXE Matching] Đăng ký đề tài thành công: {@event.TopicTitle} (Mã: {@event.TopicCode})";
        var body = $"""
            <div style="font-family: Arial, sans-serif;">
                <h3>Xác Nhận Đăng Ký Đề Tài</h3>
                <p>Nhóm {@event.GroupId} đã đăng ký đề tài <strong>{@event.TopicTitle}</strong> (Mã: <strong>{@event.TopicCode}</strong>).</p>
                <p>Thời gian đăng ký: {@event.RegisteredAt:yyyy-MM-dd HH:mm:ss} UTC.</p>
            </div>
            """;

        var recipient = !string.IsNullOrWhiteSpace(@event.ContactEmail)
            ? @event.ContactEmail
            : (!string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail) ? _emailSettings.DefaultRecipientEmail : "team@exeteammatching.com");

        await SendAndRecordAsync(
            topic: "topic-registered",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(TopicRegisteredEvent),
            recipient: recipient,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task ProcessMentorRequestedAsync(MentorRequestedEvent @event, string? key, CancellationToken ct)
    {
        var groupName = !string.IsNullOrWhiteSpace(@event.GroupName) ? @event.GroupName : $"Nhóm {@event.GroupId}";
        var topicName = !string.IsNullOrWhiteSpace(@event.Topic) ? $" (Đề tài: {@event.Topic})" : "";
        var subject = $"[EXE Matching] Yêu cầu hướng dẫn mới từ {groupName}";
        var body = $"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h3 style="color: #2b5797;">Yêu Cầu Hướng Dẫn Mới</h3>
                <p>Kính gửi Quý Giảng viên,</p>
                <p>Nhóm <strong>{groupName}</strong>{topicName} đã gửi yêu cầu hướng dẫn đến Quý Thầy/Cô trên Hệ thống EXE Team Matching.</p>
                <div style="background-color: #f8f9fa; border-left: 4px solid #2b5797; padding: 12px; margin: 15px 0;">
                    <p style="margin: 0;"><strong>Lời nhắn từ nhóm:</strong></p>
                    <p style="margin: 5px 0 0 0; font-style: italic;">"{@event.Message}"</p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Thời gian gửi: {@event.RequestedAt:yyyy-MM-dd HH:mm:ss} UTC</p>
                </div>
                <p>Vui lòng đăng nhập vào hệ thống để phản hồi yêu cầu.</p>
            </div>
            """;

        var recipient = !string.IsNullOrWhiteSpace(@event.MentorEmail)
            ? @event.MentorEmail
            : (!string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail) ? _emailSettings.DefaultRecipientEmail : "mentor@exeteammatching.com");

        await SendAndRecordAsync(
            topic: "mentor-requested",
            eventKey: key ?? @event.RequestId.ToString(),
            eventType: nameof(MentorRequestedEvent),
            recipient: recipient,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task ProcessMentorDecisionAsync(MentorDecisionEvent @event, string? key, CancellationToken ct)
    {
        var decisionText = @event.IsAccepted ? "ĐÃ CHẤP NHẬN" : "TỪ CHỐI";
        var groupName = !string.IsNullOrWhiteSpace(@event.GroupName) ? @event.GroupName : $"Nhóm {@event.GroupId}";
        var subject = $"[EXE Matching] Giảng viên đã {decisionText.ToLower()} yêu cầu hướng dẫn của {groupName}";
        var body = $"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h3 style="color: #2b5797;">Kết Quả Yêu Cầu Hướng Dẫn: <span style="color: {(@event.IsAccepted ? "green" : "red")};">{decisionText}</span></h3>
                <p>Xin chào nhóm <strong>{groupName}</strong>,</p>
                <p>Giảng viên hướng dẫn đã đưa ra quyết định đối với yêu cầu của nhóm:</p>
                <div style="background-color: #f8f9fa; border-left: 4px solid {(@event.IsAccepted ? "green" : "red")}; padding: 12px; margin: 15px 0;">
                    <p style="margin: 0;"><strong>Kết quả:</strong> {decisionText}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Lý do / Phản hồi:</strong> {@event.DecisionReason}</p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Thời gian: {@event.DecidedAt:yyyy-MM-dd HH:mm:ss} UTC</p>
                </div>
            </div>
            """;

        var recipient = !string.IsNullOrWhiteSpace(@event.RequesterEmail)
            ? @event.RequesterEmail
            : (!string.IsNullOrWhiteSpace(@event.MentorEmail) ? @event.MentorEmail : (!string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail) ? _emailSettings.DefaultRecipientEmail : "student@exeteammatching.com"));

        await SendAndRecordAsync(
            topic: "mentor-decision",
            eventKey: key ?? @event.RequestId.ToString(),
            eventType: nameof(MentorDecisionEvent),
            recipient: recipient,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task SendAndRecordAsync(
        string topic,
        string? eventKey,
        string eventType,
        string recipient,
        string subject,
        string body,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(recipient) || recipient.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
        {
            recipient = !string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail)
                ? _emailSettings.DefaultRecipientEmail
                : "notification@exeteammatching.com";
        }

        var record = new NotificationRecord
        {
            Topic = topic,
            EventKey = eventKey,
            EventType = eventType,
            Recipient = recipient,
            Subject = subject,
            Body = body,
            ProcessedAt = DateTime.UtcNow
        };

        try
        {
            await _emailService.SendEmailAsync(recipient, subject, body, isHtml: true, cancellationToken);
            record.IsSuccess = true;
            _logger.LogInformation("Notification handled successfully for event {EventType} to {Recipient}", eventType, recipient);
        }
        catch (Exception ex)
        {
            record.IsSuccess = false;
            record.ErrorMessage = ex.Message;
            _logger.LogError(ex, "Failed to send notification for event {EventType} to {Recipient}", eventType, recipient);
        }
        finally
        {
            _store.Record(record);
        }
    }
}
