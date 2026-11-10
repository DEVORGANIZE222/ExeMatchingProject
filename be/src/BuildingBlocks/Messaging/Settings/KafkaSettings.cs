namespace EXETeamMatching.Messaging.Settings;

public class KafkaSettings
{
    public string BootstrapServers { get; set; } = "localhost:9092";
    public string GroupId { get; set; } = "exe-team-matching-group";
    public string? SecurityProtocol { get; set; }
    public string? SaslMechanism { get; set; }
    public string? SaslUsername { get; set; }
    public string? SaslPassword { get; set; }
    public string? SslCaLocation { get; set; }
    public string? SslCaPem { get; set; }
    public string? SslCertificatePem { get; set; }
    public string? SslKeyPem { get; set; }
}
