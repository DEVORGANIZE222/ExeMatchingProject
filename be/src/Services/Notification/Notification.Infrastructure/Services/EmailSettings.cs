namespace EXETeamMatching.Notification.Infrastructure.Services;

public class EmailSettings
{
    public string SmtpServer { get; set; } = "smtp.gmail.com";
    public int SmtpPort { get; set; } = 587;
    public string SenderEmail { get; set; } = "noreply@exeteammatching.com";
    public string SenderName { get; set; } = "EXE Team Matching System";
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool EnableSsl { get; set; } = true;
    public bool SimulateOnly { get; set; } = false;
}
