using System.Net;
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
        var subject = $"[ExeMatching] Chào mừng {@event.FullName} tham gia học kỳ {@event.SemesterCode}";
        var fullName = WebUtility.HtmlEncode(@event.FullName);
        var studentCode = WebUtility.HtmlEncode(@event.StudentCode);
        var semesterCode = WebUtility.HtmlEncode(@event.SemesterCode);

        var body = BuildBrandedEmail(
            heading: "Chào mừng tham gia học kỳ mới",
            badgeLabel: semesterCode,
            badgeBg: "#dcfce7",
            badgeFg: "#15803d",
            accentColor: "#16a34a",
            innerHtml: $"""
                <p style="margin: 0 0 12px 0;">Xin chào <strong>{fullName}</strong> (MSSV: <strong>{studentCode}</strong>),</p>
                <p style="margin: 0 0 16px 0;">Hồ sơ sinh viên của bạn đã được ghi nhận vào hệ thống cho học kỳ <strong>{semesterCode}</strong>.</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
                    <ul style="margin: 0; padding-left: 18px; color: #334155;">
                        <li style="margin-bottom: 4px;"><strong>Mã sinh viên:</strong> {studentCode}</li>
                        <li style="margin-bottom: 4px;"><strong>Họ và tên:</strong> {fullName}</li>
                        <li style="margin-bottom: 4px;"><strong>Học kỳ:</strong> {semesterCode}</li>
                        <li><strong>Thời gian ghi nhận:</strong> {@event.ImportedAt:yyyy-MM-dd HH:mm:ss} UTC</li>
                    </ul>
                </div>
                <p style="margin: 0; color: #475569;">Vui lòng đăng nhập vào ExeMatching để kiểm tra hồ sơ, chọn kỹ năng thế mạnh và tham gia ghép nhóm.</p>
                """);

        await SendAndRecordAsync(
            topic: "student-imported",
            eventKey: key ?? @event.StudentId.ToString(),
            eventType: nameof(StudentImportedEvent),
            recipient: @event.Email,
            subject: subject,
            body: body,
            cancellationToken: ct,
            allowDefaultFallback: false);
    }

    private async Task ProcessGroupCreatedAsync(GroupCreatedEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[ExeMatching] Nhóm {@event.GroupName} (Mã: {@event.GroupCode}) đã được tạo";
        var body = BuildBrandedEmail(
            heading: "Thông báo tạo nhóm mới",
            badgeLabel: "Nhóm mới",
            badgeBg: "#dcfce7",
            badgeFg: "#15803d",
            accentColor: "#16a34a",
            innerHtml: $"""
                <p style="margin: 0 0 12px 0;">Nhóm <strong>{WebUtility.HtmlEncode(@event.GroupName)}</strong> đã được khởi tạo thành công trên hệ thống.</p>
                <ul style="margin: 0; padding-left: 18px; color: #334155;">
                    <li><strong>Mã nhóm:</strong> {WebUtility.HtmlEncode(@event.GroupCode)}</li>
                    <li><strong>Thời gian tạo:</strong> {@event.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC</li>
                </ul>
                """);

        await SendAndRecordAsync(
            topic: "group-created",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(GroupCreatedEvent),
            recipient: @event.CreatorEmail,
            subject: subject,
            body: body,
            cancellationToken: ct,
            allowDefaultFallback: false);
    }

    private async Task ProcessGroupLockedAsync(GroupLockedEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[ExeMatching] Nhóm {@event.GroupCode} đã chốt danh sách thành viên";
        var body = BuildBrandedEmail(
            heading: $"Nhóm {WebUtility.HtmlEncode(@event.GroupCode)} đã khóa danh sách",
            badgeLabel: "Đã chốt nhóm",
            badgeBg: "#ccfbf1",
            badgeFg: "#0f766e",
            accentColor: "#0d9488",
            innerHtml: $"""
                <p style="margin: 0;">Nhóm đã hoàn thành ghép nhóm với <strong>{@event.MemberCount}</strong> thành viên và khóa danh sách lúc {@event.LockedAt:yyyy-MM-dd HH:mm:ss} UTC.</p>
                """);

        await SendAndRecordAsync(
            topic: "group-locked",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(GroupLockedEvent),
            recipient: @event.ContactEmail,
            subject: subject,
            body: body,
            cancellationToken: ct,
            allowDefaultFallback: false);
    }

    private async Task ProcessLeaderElectedAsync(LeaderElectedEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[ExeMatching] Nhóm {@event.GroupId} đã hoàn tất bầu Trưởng nhóm";
        var body = BuildBrandedEmail(
            heading: "Kết quả bầu Trưởng nhóm",
            badgeLabel: "Leader",
            badgeBg: "#fef3c7",
            badgeFg: "#b45309",
            accentColor: "#d97706",
            innerHtml: $"""
                <p style="margin: 0;">Sinh viên ID <strong>{@event.LeaderStudentId}</strong> đã được bầu làm Trưởng nhóm lúc {@event.ElectedAt:yyyy-MM-dd HH:mm:ss} UTC.</p>
                """);

        await SendAndRecordAsync(
            topic: "leader-elected",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(LeaderElectedEvent),
            recipient: @event.LeaderEmail,
            subject: subject,
            body: body,
            cancellationToken: ct,
            allowDefaultFallback: false);
    }

    private async Task ProcessTopicRegisteredAsync(TopicRegisteredEvent @event, string? key, CancellationToken ct)
    {
        var subject = $"[ExeMatching] Đăng ký đề tài thành công: {@event.TopicTitle} (Mã: {@event.TopicCode})";
        var body = BuildBrandedEmail(
            heading: "Xác nhận đăng ký đề tài",
            badgeLabel: "Đề tài",
            badgeBg: "#dcfce7",
            badgeFg: "#15803d",
            accentColor: "#16a34a",
            innerHtml: $"""
                <p style="margin: 0 0 8px 0;">Nhóm {@event.GroupId} đã đăng ký đề tài <strong>{WebUtility.HtmlEncode(@event.TopicTitle)}</strong> (Mã: <strong>{WebUtility.HtmlEncode(@event.TopicCode)}</strong>).</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">Thời gian đăng ký: {@event.RegisteredAt:yyyy-MM-dd HH:mm:ss} UTC.</p>
                """);

        await SendAndRecordAsync(
            topic: "topic-registered",
            eventKey: key ?? @event.GroupId.ToString(),
            eventType: nameof(TopicRegisteredEvent),
            recipient: @event.ContactEmail,
            subject: subject,
            body: body,
            cancellationToken: ct,
            allowDefaultFallback: false);
    }

    private async Task ProcessMentorRequestedAsync(MentorRequestedEvent @event, string? key, CancellationToken ct)
    {
        var groupName = !string.IsNullOrWhiteSpace(@event.GroupName) ? @event.GroupName : $"Nhóm {@event.GroupId}";
        var encodedGroup = WebUtility.HtmlEncode(groupName);
        var encodedTopic = !string.IsNullOrWhiteSpace(@event.Topic)
            ? $" (Đề tài: <strong>{WebUtility.HtmlEncode(@event.Topic)}</strong>)"
            : string.Empty;
        var encodedMessage = WebUtility.HtmlEncode(@event.Message);

        var subject = $"[ExeMatching] Yêu cầu hướng dẫn mới từ {groupName}";
        var body = BuildBrandedEmail(
            heading: "Lời mời hướng dẫn nhóm mới",
            badgeLabel: "Chờ phản hồi",
            badgeBg: "#fef3c7",
            badgeFg: "#b45309",
            accentColor: "#16a34a",
            innerHtml: $"""
                <p style="margin: 0 0 12px 0;">Kính gửi Quý Giảng viên,</p>
                <p style="margin: 0 0 16px 0;">Nhóm <strong>{encodedGroup}</strong>{encodedTopic} đã gửi lời mời hướng dẫn đến Quý Thầy/Cô trên hệ thống <strong>ExeMatching</strong>.</p>
                <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
                    <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #15803d;">Lời nhắn từ sinh viên</p>
                    <p style="margin: 0; font-style: italic; color: #1e293b;">"{encodedMessage}"</p>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b;">Thời gian gửi: {@event.RequestedAt:yyyy-MM-dd HH:mm:ss} UTC</p>
                </div>
                <p style="margin: 0; color: #475569;">Quý Thầy/Cô vui lòng đăng nhập vào ExeMatching (mục <strong>Duyệt nhóm &amp; Đề tài</strong>) để xem xét và phản hồi yêu cầu.</p>
                """);

        await SendAndRecordAsync(
            topic: "mentor-requested",
            eventKey: key ?? @event.RequestId.ToString(),
            eventType: nameof(MentorRequestedEvent),
            recipient: @event.MentorEmail,
            subject: subject,
            body: body,
            cancellationToken: ct);
    }

    private async Task ProcessMentorDecisionAsync(MentorDecisionEvent @event, string? key, CancellationToken ct)
    {
        var decisionText = @event.IsAccepted ? "ĐÃ CHẤP NHẬN" : "TỪ CHỐI";
        var decisionAction = @event.IsAccepted ? "chấp nhận" : "từ chối";
        var groupName = !string.IsNullOrWhiteSpace(@event.GroupName) ? @event.GroupName : $"Nhóm {@event.GroupId}";
        var mentorLabel = !string.IsNullOrWhiteSpace(@event.MentorName) ? @event.MentorName : "Giảng viên hướng dẫn";
        var reasonText = string.IsNullOrWhiteSpace(@event.DecisionReason)
            ? "Không có ghi chú thêm."
            : @event.DecisionReason;

        var accentColor = @event.IsAccepted ? "#16a34a" : "#dc2626";
        var boxBg = @event.IsAccepted ? "#f0fdf4" : "#fef2f2";
        var badgeBg = @event.IsAccepted ? "#dcfce7" : "#fee2e2";
        var badgeFg = @event.IsAccepted ? "#15803d" : "#b91c1c";
        var badgeLabel = @event.IsAccepted ? "Đã chấp thuận" : "Đã từ chối";

        var subject = $"[ExeMatching] {mentorLabel} đã {decisionAction} yêu cầu hướng dẫn của {groupName}";
        var body = BuildBrandedEmail(
            heading: $"Kết quả yêu cầu hướng dẫn: {decisionText}",
            badgeLabel: badgeLabel,
            badgeBg: badgeBg,
            badgeFg: badgeFg,
            accentColor: accentColor,
            innerHtml: $"""
                <p style="margin: 0 0 12px 0;">Xin chào các thành viên nhóm <strong>{WebUtility.HtmlEncode(groupName)}</strong>,</p>
                <p style="margin: 0 0 16px 0;"><strong>{WebUtility.HtmlEncode(mentorLabel)}</strong> đã phản hồi yêu cầu hướng dẫn của nhóm trên hệ thống <strong>ExeMatching</strong>:</p>
                <div style="background-color: {boxBg}; border-left: 4px solid {accentColor}; border-radius: 6px; padding: 14px 16px; margin: 16px 0;">
                    <p style="margin: 0 0 6px 0;"><strong>Kết quả:</strong> <span style="color: {badgeFg}; font-weight: 700;">{decisionText}</span></p>
                    <p style="margin: 0 0 8px 0;"><strong>Phản hồi từ giảng viên:</strong> {WebUtility.HtmlEncode(reasonText)}</p>
                    <p style="margin: 0; font-size: 12px; color: #64748b;">Thời gian phản hồi: {@event.DecidedAt:yyyy-MM-dd HH:mm:ss} UTC</p>
                </div>
                <p style="margin: 0; color: #475569;">Vui lòng đăng nhập vào ExeMatching để xem trạng thái nhóm và thông báo chi tiết.</p>
                """);

        var candidateRecipients = new List<string>();
        if (@event.RecipientEmails is { Count: > 0 })
            candidateRecipients.AddRange(@event.RecipientEmails);
        if (!string.IsNullOrWhiteSpace(@event.RequesterEmail))
            candidateRecipients.Add(@event.RequesterEmail);

        var resolvedRecipients = candidateRecipients
            .Where(email => !string.IsNullOrWhiteSpace(email) && !email.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
            .Select(email => email.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (resolvedRecipients.Count == 0 && !string.IsNullOrWhiteSpace(@event.MentorEmail)
            && !@event.MentorEmail.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
        {
            resolvedRecipients.Add(@event.MentorEmail.Trim());
        }

        if (resolvedRecipients.Count == 0)
        {
            await SendAndRecordAsync(
                topic: "mentor-decision",
                eventKey: key ?? @event.RequestId.ToString(),
                eventType: nameof(MentorDecisionEvent),
                recipient: null,
                subject: subject,
                body: body,
                cancellationToken: ct,
                allowDefaultFallback: true);
            return;
        }

        foreach (var recipient in resolvedRecipients)
        {
            await SendAndRecordAsync(
                topic: "mentor-decision",
                eventKey: key ?? @event.RequestId.ToString(),
                eventType: nameof(MentorDecisionEvent),
                recipient: recipient,
                subject: subject,
                body: body,
                cancellationToken: ct,
                allowDefaultFallback: false);
        }
    }

    private static string BuildBrandedEmail(
        string heading,
        string badgeLabel,
        string badgeBg,
        string badgeFg,
        string accentColor,
        string innerHtml)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1e293b;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                    <div style="padding: 16px 24px; background-color: #f0fdf4; border-bottom: 1px solid #dcfce7;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="vertical-align: middle;">
                                    <img src="cid:{EmailService.BrandLogoContentId}" alt="ExeMatching" width="28" height="28" style="display: inline-block; vertical-align: middle; border-radius: 6px; margin-right: 8px;" />
                                    <span style="font-size: 18px; font-weight: 800; vertical-align: middle; letter-spacing: -0.02em;">
                                        <span style="color: #16a34a;">Exe</span><span style="color: #0f172a;">Matching</span>
                                    </span>
                                </td>
                                <td align="right" style="vertical-align: middle;">
                                    <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background-color: {badgeBg}; color: {badgeFg}; font-size: 12px; font-weight: 700;">
                                        {badgeLabel}
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <div style="padding: 24px;">
                        <h2 style="margin: 0 0 16px 0; font-size: 18px; color: {accentColor};">{heading}</h2>
                        {innerHtml}
                        <p style="margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
                            Email được gửi tự động từ <strong>ExeMatching</strong> — Hệ thống Ghép nhóm &amp; Hướng dẫn Dự án EXE.
                        </p>
                    </div>
                </div>
            </body>
            </html>
            """;
    }

    private async Task SendAndRecordAsync(
        string topic,
        string? eventKey,
        string eventType,
        string? recipient,
        string subject,
        string body,
        CancellationToken cancellationToken,
        bool allowDefaultFallback = true)
    {
        var resolvedRecipient = !string.IsNullOrWhiteSpace(recipient) && !recipient.EndsWith(".internal", StringComparison.OrdinalIgnoreCase)
            ? recipient.Trim()
            : (allowDefaultFallback && !string.IsNullOrWhiteSpace(_emailSettings.DefaultRecipientEmail)
                ? _emailSettings.DefaultRecipientEmail.Trim()
                : null);

        if (string.IsNullOrWhiteSpace(resolvedRecipient))
        {
            _logger.LogInformation(
                "Skipping email for topic '{Topic}' ({EventType}, key '{Key}'): recipient email is null.",
                topic,
                eventType,
                eventKey);
            return;
        }

        var record = new NotificationRecord
        {
            Topic = topic,
            EventKey = eventKey,
            EventType = eventType,
            Recipient = resolvedRecipient,
            Subject = subject,
            Body = body,
            ProcessedAt = DateTime.UtcNow
        };

        try
        {
            await _emailService.SendEmailAsync(resolvedRecipient, subject, body, isHtml: true, cancellationToken);
            record.IsSuccess = true;
            _logger.LogInformation("Notification handled successfully for event {EventType} to {Recipient}", eventType, resolvedRecipient);
        }
        catch (Exception ex)
        {
            record.IsSuccess = false;
            record.ErrorMessage = ex.Message;
            _logger.LogError(ex, "Failed to send notification for event {EventType} to {Recipient}", eventType, resolvedRecipient);
        }
        finally
        {
            _store.Record(record);
        }
    }
}
