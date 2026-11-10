using Confluent.Kafka;
using Microsoft.Extensions.Configuration;

namespace EXETeamMatching.Messaging.Settings;

/// <summary>
/// Centralizes Kafka client configuration so local plaintext Docker brokers and
/// TLS/SASL cloud brokers (Redpanda Serverless, Confluent Cloud, Aiven) share one setup path.
/// </summary>
public static class KafkaConfigHelper
{
    private const string LinuxSystemCaBundle = "/etc/ssl/certs/ca-certificates.crt";

    public static KafkaSettings Resolve(IConfiguration configuration, KafkaSettings? defaults = null)
    {
        var section = configuration.GetSection("KafkaSettings");
        var resolved = new KafkaSettings
        {
            BootstrapServers = Pick(section["BootstrapServers"], defaults?.BootstrapServers) ?? "localhost:9092",
            GroupId = Pick(section["GroupId"], defaults?.GroupId) ?? "exe-team-matching-group",
            SecurityProtocol = Pick(section["SecurityProtocol"], defaults?.SecurityProtocol),
            SaslMechanism = Pick(section["SaslMechanism"], defaults?.SaslMechanism),
            SaslUsername = Pick(section["SaslUsername"], defaults?.SaslUsername),
            SaslPassword = Pick(section["SaslPassword"], defaults?.SaslPassword),
            SslCaLocation = Pick(section["SslCaLocation"], defaults?.SslCaLocation),
            SslCaPem = Pick(section["SslCaPem"], defaults?.SslCaPem),
            SslCertificatePem = Pick(section["SslCertificatePem"], defaults?.SslCertificatePem),
            SslKeyPem = Pick(section["SslKeyPem"], defaults?.SslKeyPem)
        };

        return resolved;
    }

    public static void ApplyTo(ClientConfig config, KafkaSettings settings)
    {
        config.BootstrapServers = string.IsNullOrWhiteSpace(settings.BootstrapServers)
            ? "localhost:9092"
            : settings.BootstrapServers.Trim();

        var securityProtocol = ResolveSecurityProtocol(settings);
        if (securityProtocol.HasValue)
        {
            config.SecurityProtocol = securityProtocol.Value;
        }

        if (securityProtocol is SecurityProtocol.SaslSsl or SecurityProtocol.SaslPlaintext)
        {
            var mechanism = ParseSaslMechanism(settings.SaslMechanism)
                            ?? (config.BootstrapServers.Contains("redpanda.com", StringComparison.OrdinalIgnoreCase)
                                ? SaslMechanism.ScramSha256
                                : SaslMechanism.Plain);
            config.SaslMechanism = mechanism;

            if (!string.IsNullOrWhiteSpace(settings.SaslUsername))
            {
                config.SaslUsername = settings.SaslUsername.Trim();
            }

            if (!string.IsNullOrWhiteSpace(settings.SaslPassword))
            {
                config.SaslPassword = settings.SaslPassword;
            }
        }

        if (NormalizePem(settings.SslCaPem) is { } caPem)
        {
            config.SslCaPem = caPem;
        }
        else if (!string.IsNullOrWhiteSpace(settings.SslCaLocation))
        {
            config.SslCaLocation = settings.SslCaLocation.Trim();
        }
        else if (securityProtocol is SecurityProtocol.Ssl or SecurityProtocol.SaslSsl
                 && OperatingSystem.IsLinux()
                 && File.Exists(LinuxSystemCaBundle))
        {
            config.SslCaLocation = LinuxSystemCaBundle;
        }

        if (NormalizePem(settings.SslCertificatePem) is { } certPem)
        {
            config.SslCertificatePem = certPem;
        }

        if (NormalizePem(settings.SslKeyPem) is { } keyPem)
        {
            config.SslKeyPem = keyPem;
        }
    }

    private static SecurityProtocol? ResolveSecurityProtocol(KafkaSettings settings)
    {
        if (!string.IsNullOrWhiteSpace(settings.SecurityProtocol))
        {
            var normalized = settings.SecurityProtocol.Trim().Replace("_", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
            return normalized switch
            {
                "plaintext" => SecurityProtocol.Plaintext,
                "ssl" => SecurityProtocol.Ssl,
                "saslplaintext" => SecurityProtocol.SaslPlaintext,
                "saslssl" => SecurityProtocol.SaslSsl,
                _ => Enum.TryParse<SecurityProtocol>(settings.SecurityProtocol.Trim(), ignoreCase: true, out var parsed)
                    ? parsed
                    : null
            };
        }

        if (!string.IsNullOrWhiteSpace(settings.SaslUsername) && !string.IsNullOrWhiteSpace(settings.SaslPassword))
        {
            return SecurityProtocol.SaslSsl;
        }

        if (!string.IsNullOrWhiteSpace(settings.SslCertificatePem) && !string.IsNullOrWhiteSpace(settings.SslKeyPem))
        {
            return SecurityProtocol.Ssl;
        }

        return null;
    }

    private static SaslMechanism? ParseSaslMechanism(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var normalized = raw.Trim()
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .ToLowerInvariant();

        return normalized switch
        {
            "plain" => SaslMechanism.Plain,
            "scramsha256" => SaslMechanism.ScramSha256,
            "scramsha512" => SaslMechanism.ScramSha512,
            "gssapi" => SaslMechanism.Gssapi,
            "oauthbearer" => SaslMechanism.OAuthBearer,
            _ => Enum.TryParse<SaslMechanism>(raw.Trim(), ignoreCase: true, out var parsed) ? parsed : null
        };
    }

    private static string? NormalizePem(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        return raw.Replace("\\r\\n", "\n", StringComparison.Ordinal)
                  .Replace("\\n", "\n", StringComparison.Ordinal)
                  .Trim();
    }

    private static string? Pick(string? primary, string? fallback)
        => !string.IsNullOrWhiteSpace(primary) ? primary : fallback;
}

