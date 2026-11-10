using Microsoft.Extensions.Configuration;

namespace EXETeamMatching.SharedKernel.Configuration;

/// <summary>
/// Helpers for cloud PaaS hosting (Render, Neon) while keeping local Docker configuration unchanged.
/// </summary>
public static class HostingExtensions
{
    public static int? GetRenderPort(this IConfiguration configuration)
    {
        var raw = Environment.GetEnvironmentVariable("PORT") ?? configuration["PORT"];
        return int.TryParse(raw?.Trim(), out var port) && port > 0 ? port : null;
    }

    /// <summary>
    /// Normalizes a PostgreSQL URI (postgres:// or postgresql:// from Render/Neon) into an Npgsql
    /// keyword connection string, passing standard Npgsql strings through untouched.
    /// </summary>
    public static string? ResolvePostgresConnectionString(this IConfiguration configuration)
    {
        var raw = configuration.GetConnectionString("DefaultConnection")
                  ?? configuration["DATABASE_CONNECTION_STRING"]
                  ?? configuration["DATABASE_URL"];

        return NormalizePostgresConnectionString(raw);
    }

    public static string? NormalizePostgresConnectionString(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return raw;
        }

        var trimmed = raw.Trim();
        if (!trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            return trimmed;
        }

        var colonIndex = uri.UserInfo.IndexOf(':');
        var username = colonIndex >= 0
            ? Uri.UnescapeDataString(uri.UserInfo[..colonIndex])
            : Uri.UnescapeDataString(uri.UserInfo);
        var password = colonIndex >= 0
            ? Uri.UnescapeDataString(uri.UserInfo[(colonIndex + 1)..])
            : string.Empty;

        var database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/'));
        var port = uri.Port > 0 ? uri.Port : 5432;

        var query = ParseQuery(uri.Query);
        var sslMode = query.TryGetValue("sslmode", out var rawSslMode)
            ? MapSslMode(rawSslMode)
            : "Prefer";

        var parts = new List<string>
        {
            $"Host={EscapeNpgsqlValue(uri.Host)}",
            $"Port={port}",
            $"Database={EscapeNpgsqlValue(database)}",
            $"Username={EscapeNpgsqlValue(username)}",
            $"Password={EscapeNpgsqlValue(password)}",
            $"Ssl Mode={sslMode}"
        };

        if (query.TryGetValue("channel_binding", out var rawChannelBinding)
            && MapChannelBinding(rawChannelBinding) is { } channelBinding)
        {
            parts.Add($"Channel Binding={channelBinding}");
        }

        return string.Join(';', parts);
    }

    private static Dictionary<string, string> ParseQuery(string queryString)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(queryString))
        {
            return values;
        }

        foreach (var pair in queryString.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eqIndex = pair.IndexOf('=');
            var key = eqIndex >= 0 ? Uri.UnescapeDataString(pair[..eqIndex]) : Uri.UnescapeDataString(pair);
            var value = eqIndex >= 0 ? Uri.UnescapeDataString(pair[(eqIndex + 1)..]) : string.Empty;
            if (!string.IsNullOrWhiteSpace(key))
            {
                values[key] = value;
            }
        }

        return values;
    }

    private static string MapSslMode(string raw) => raw.Trim().ToLowerInvariant() switch
    {
        "disable" => "Disable",
        "allow" => "Allow",
        "prefer" => "Prefer",
        "require" => "Require",
        "verify-ca" => "VerifyCA",
        "verify-full" => "VerifyFull",
        _ => "Prefer"
    };

    private static string? MapChannelBinding(string raw) => raw.Trim().ToLowerInvariant() switch
    {
        "disable" => "Disable",
        "prefer" => "Prefer",
        "require" => "Require",
        _ => null
    };

    private static string EscapeNpgsqlValue(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var needsQuotes = value.IndexOfAny([';', '\'', '"', '=']) >= 0
                          || char.IsWhiteSpace(value[0])
                          || char.IsWhiteSpace(value[^1]);

        return needsQuotes ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }
}

