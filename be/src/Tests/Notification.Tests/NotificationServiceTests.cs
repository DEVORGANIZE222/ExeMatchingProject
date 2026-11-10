using System.Text.Json;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.Notification.Application.Interfaces;
using EXETeamMatching.Notification.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace EXETeamMatching.Notification.Tests;

public class NotificationServiceTests
{
    private class TestEmailService : IEmailService
    {
        public List<(string To, string Subject, string Body, bool IsHtml)> SentEmails { get; } = [];

        public Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
        {
            return SendEmailAsync(to, subject, body, isHtml: true, cancellationToken);
        }

        public Task SendEmailAsync(string to, string subject, string body, bool isHtml, CancellationToken cancellationToken = default)
        {
            SentEmails.Add((to, subject, body, isHtml));
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task StudentImportedEvent_Sends_Welcome_Email_And_Records_Store()
    {
        var emailService = new TestEmailService();
        var store = new InMemoryNotificationStore();
        var handler = new NotificationHandler(emailService, store, NullLogger<NotificationHandler>.Instance);

        var studentId = Guid.NewGuid();
        var evt = new StudentImportedEvent(
            StudentId: studentId,
            StudentCode: "SE184226",
            FullName: "Lam Hoang Nhan",
            Email: "nhanlh@fpt.edu.vn",
            SemesterCode: "FALL2026",
            ImportedAt: DateTime.UtcNow
        );

        await handler.HandleEventAsync(evt);

        Assert.Single(emailService.SentEmails);
        var sent = emailService.SentEmails[0];
        Assert.Equal("nhanlh@fpt.edu.vn", sent.To);
        Assert.Contains("FALL2026", sent.Subject);
        Assert.Contains("Lam Hoang Nhan", sent.Subject);
        Assert.Contains("SE184226", sent.Body);
        Assert.True(sent.IsHtml);

        var recent = store.GetRecent();
        Assert.Single(recent);
        Assert.Equal("student-imported", recent[0].Topic);
        Assert.Equal("nhanlh@fpt.edu.vn", recent[0].Recipient);
        Assert.True(recent[0].IsSuccess);
    }

    [Fact]
    public async Task HandleEventJsonAsync_Processes_StudentImported_From_Kafka()
    {
        var emailService = new TestEmailService();
        var store = new InMemoryNotificationStore();
        var handler = new NotificationHandler(emailService, store, NullLogger<NotificationHandler>.Instance);

        var studentId = Guid.NewGuid();
        var evt = new StudentImportedEvent(
            StudentId: studentId,
            StudentCode: "SE200001",
            FullName: "Nguyen Van A",
            Email: "student@example.edu",
            SemesterCode: "SPRING2027",
            ImportedAt: DateTime.UtcNow
        );
        var payload = JsonSerializer.Serialize(evt);

        await handler.HandleEventJsonAsync("student-imported", studentId.ToString(), payload);

        Assert.Single(emailService.SentEmails);
        Assert.Equal("student@example.edu", emailService.SentEmails[0].To);
        Assert.Contains("SPRING2027", emailService.SentEmails[0].Subject);
        Assert.Contains("Nguyen Van A", emailService.SentEmails[0].Subject);
    }

    [Fact]
    public async Task GroupEvents_With_Null_Emails_Are_Skipped_Even_When_DefaultRecipient_Configured()
    {
        var emailService = new TestEmailService();
        var store = new InMemoryNotificationStore();
        var settings = Options.Create(new EmailSettings { DefaultRecipientEmail = "fallback@university.edu" });
        var handler = new NotificationHandler(emailService, store, settings, NullLogger<NotificationHandler>.Instance);

        await handler.HandleEventAsync(new GroupCreatedEvent(Guid.NewGuid(), "GRP001", "The Pioneers", Guid.NewGuid(), DateTime.UtcNow));
        await handler.HandleEventAsync(new GroupLockedEvent(Guid.NewGuid(), "GRP001", 5, DateTime.UtcNow));
        await handler.HandleEventAsync(new LeaderElectedEvent(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow));
        await handler.HandleEventAsync(new TopicRegisteredEvent(Guid.NewGuid(), "TOPIC01", "AI Matching Platform", DateTime.UtcNow));

        Assert.Empty(emailService.SentEmails);
        Assert.Empty(store.GetRecent(10));
    }

    [Fact]
    public async Task GroupEvents_And_MentorEvents_With_Recipients_Are_Dispatched_Correctly()
    {
        var emailService = new TestEmailService();
        var store = new InMemoryNotificationStore();
        var handler = new NotificationHandler(emailService, store, NullLogger<NotificationHandler>.Instance);

        await handler.HandleEventAsync(new GroupCreatedEvent(Guid.NewGuid(), "GRP001", "The Pioneers", Guid.NewGuid(), DateTime.UtcNow, "creator@university.edu"));
        await handler.HandleEventAsync(new GroupLockedEvent(Guid.NewGuid(), "GRP001", 5, DateTime.UtcNow, "leader@university.edu"));
        await handler.HandleEventAsync(new LeaderElectedEvent(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow, "leader@university.edu"));
        await handler.HandleEventAsync(new TopicRegisteredEvent(Guid.NewGuid(), "TOPIC01", "AI Matching Platform", DateTime.UtcNow, "leader@university.edu"));
        await handler.HandleEventAsync(new MentorRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Please mentor us", DateTime.UtcNow, MentorEmail: "mentor@university.edu"));
        await handler.HandleEventAsync(new MentorDecisionEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), true, "Strong proposal", DateTime.UtcNow, RequesterEmail: "student@university.edu"));

        Assert.Equal(6, emailService.SentEmails.Count);
        var recent = store.GetRecent(10);
        Assert.Equal(6, recent.Count);
    }

    [Fact]
    public void DeduplicationService_Blocks_Duplicate_Keys()
    {
        var dedup = new InMemoryDeduplicationService(NullLogger<InMemoryDeduplicationService>.Instance);
        var key = Guid.NewGuid().ToString();

        var firstAttempt = dedup.TryAcquire(key);
        var secondAttempt = dedup.TryAcquire(key);

        Assert.True(firstAttempt);
        Assert.False(secondAttempt);
        Assert.True(dedup.IsProcessed(key));
    }

    [Fact]
    public async Task EmailService_SimulationMode_Does_Not_Throw()
    {
        var settings = Options.Create(new EmailSettings
        {
            SimulateOnly = true,
            SenderEmail = "noreply@exeteammatching.com",
            SenderName = "EXE System"
        });

        var emailService = new EmailService(settings, NullLogger<EmailService>.Instance);

        // Should not throw even with no real SMTP server
        await emailService.SendEmailAsync("test@example.com", "Test Subject", "<p>Test Body</p>");
    }

    [Fact]
    public async Task Malformed_Json_Is_Handled_Resiliently_Without_Crashing()
    {
        var emailService = new TestEmailService();
        var store = new InMemoryNotificationStore();
        var handler = new NotificationHandler(emailService, store, NullLogger<NotificationHandler>.Instance);

        await handler.HandleEventJsonAsync("student-imported", "bad-key", "{ this is not valid json }");

        Assert.Empty(emailService.SentEmails);
        var recent = store.GetRecent();
        Assert.Single(recent);
        Assert.False(recent[0].IsSuccess);
        Assert.NotNull(recent[0].ErrorMessage);
    }

    [Fact]
    public async Task Mentor_Requested_And_Decision_With_Direct_Emails_Sends_To_Real_Recipients()
    {
        var emailService = new TestEmailService();
        var store = new InMemoryNotificationStore();
        var handler = new NotificationHandler(emailService, store, NullLogger<NotificationHandler>.Instance);

        var mentorEmail = "mentor@university.edu";
        var studentEmail = "student123@university.edu";

        var mentorReq = new MentorRequestedEvent(
            RequestId: Guid.NewGuid(),
            GroupId: Guid.NewGuid(),
            MentorId: Guid.NewGuid(),
            Message: "We need your guidance on AI",
            RequestedAt: DateTime.UtcNow,
            MentorEmail: mentorEmail,
            RequesterEmail: studentEmail,
            GroupName: "AI Innovators",
            Topic: "Healthcare AI"
        );

        await handler.HandleEventAsync(mentorReq);

        Assert.Single(emailService.SentEmails);
        Assert.Equal(mentorEmail, emailService.SentEmails[0].To);
        Assert.Contains("AI Innovators", emailService.SentEmails[0].Subject);
        Assert.Contains("Healthcare AI", emailService.SentEmails[0].Body);

        var mentorDecision = new MentorDecisionEvent(
            RequestId: Guid.NewGuid(),
            GroupId: Guid.NewGuid(),
            MentorId: Guid.NewGuid(),
            IsAccepted: true,
            DecisionReason: "Impressive project scope",
            DecidedAt: DateTime.UtcNow,
            RequesterEmail: studentEmail,
            MentorEmail: mentorEmail,
            GroupName: "AI Innovators"
        );

        await handler.HandleEventAsync(mentorDecision);

        Assert.Equal(2, emailService.SentEmails.Count);
        Assert.Equal(studentEmail, emailService.SentEmails[1].To);
        Assert.Contains("đã chấp nhận", emailService.SentEmails[1].Subject);
        Assert.DoesNotContain("đã đã", emailService.SentEmails[1].Subject);
        Assert.Contains("ĐÃ CHẤP NHẬN", emailService.SentEmails[1].Body);
        Assert.Contains($"cid:{EmailService.BrandLogoContentId}", emailService.SentEmails[1].Body);
    }

    [Fact]
    public async Task Mentor_Decision_Dispatches_To_All_Real_Group_Members_Without_Duplicates()
    {
        var emailService = new TestEmailService();
        var store = new InMemoryNotificationStore();
        var handler = new NotificationHandler(emailService, store, NullLogger<NotificationHandler>.Instance);

        var decision = new MentorDecisionEvent(
            RequestId: Guid.NewGuid(),
            GroupId: Guid.NewGuid(),
            MentorId: Guid.NewGuid(),
            IsAccepted: false,
            DecisionReason: "Đã đủ số lượng nhóm",
            DecidedAt: DateTime.UtcNow,
            RequesterEmail: "leader@fpt.edu.vn",
            MentorEmail: "mentor@fpt.edu.vn",
            GroupName: "Team Alpha",
            MentorName: "ThS. Đặng Hùng",
            RecipientEmails: ["leader@fpt.edu.vn", "member2@fpt.edu.vn", "member3@fpt.edu.vn", "LEADER@fpt.edu.vn", "demo@demo.internal"]
        );

        await handler.HandleEventAsync(decision);

        Assert.Equal(3, emailService.SentEmails.Count);
        Assert.Equal(["leader@fpt.edu.vn", "member2@fpt.edu.vn", "member3@fpt.edu.vn"],
            emailService.SentEmails.Select(x => x.To));
        Assert.Contains("TỪ CHỐI", emailService.SentEmails[0].Body);
        Assert.Contains($"cid:{EmailService.BrandLogoContentId}", emailService.SentEmails[0].Body);
    }
}
