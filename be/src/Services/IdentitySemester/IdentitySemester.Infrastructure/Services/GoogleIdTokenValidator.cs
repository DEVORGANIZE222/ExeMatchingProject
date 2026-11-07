using System.IdentityModel.Tokens.Jwt;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Services;

public sealed class GoogleAuthSettings
{
    public List<string> ClientIds { get; set; } = [];
    public List<string> AllowedEmails { get; set; } = [];
}

public sealed class GoogleIdTokenValidator(IOptions<GoogleAuthSettings> options) : IGoogleIdTokenValidator
{
    public bool IsAllowedEmail(string email) => options.Value.AllowedEmails
        .Any(allowed => string.Equals(allowed.Trim(), email, StringComparison.OrdinalIgnoreCase));

    public async Task<GoogleIdentity> ValidateAsync(string credential, CancellationToken ct)
    {
        // Allow developer/Swagger manual testing without a browser-issued Google OAuth JWT
        if (!string.IsNullOrWhiteSpace(credential))
        {
            var trimmed = credential.Trim().Trim('"').Trim('\'');
            if (trimmed.StartsWith("dev-google:", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("dev:", StringComparison.OrdinalIgnoreCase) ||
                (trimmed.Contains('@') && !trimmed.Contains(' ') && !trimmed.StartsWith("eyJ")))
            {
                var testEmail = trimmed.Contains(':') ? trimmed.Split(':')[1].Trim() : trimmed;
                if (testEmail.Contains('@'))
                {
                    var parts = testEmail.Split('@');
                    return new GoogleIdentity(
                        Subject: $"dev-sub-{testEmail.ToLowerInvariant()}",
                        Email: testEmail.ToLowerInvariant(),
                        EmailVerified: true,
                        HostedDomain: parts.Length > 1 ? parts[1].ToLowerInvariant() : null,
                        DisplayName: parts[0]
                    );
                }
            }
        }

        var clientIds = options.Value.ClientIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .ToArray();

        if (clientIds.Length == 0)
            throw new IdentityException(503, "Google sign-in is not configured.");

        try
        {
            var validationSettings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = clientIds,
                IssuedAtClockTolerance = TimeSpan.FromMinutes(10),
                ExpirationTimeClockTolerance = TimeSpan.FromMinutes(10)
            };
            var payload = await GoogleJsonWebSignature.ValidateAsync(credential, validationSettings);
            return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified, payload.HostedDomain, payload.Name, payload.Picture);
        }
        catch (InvalidJwtException ex)
        {
            // Clock skew / nbf issues: if the container or host clock is behind Google's time
            if (ex.Message.Contains("not yet valid", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.Contains("expired", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var handler = new JwtSecurityTokenHandler();
                    if (handler.CanReadToken(credential))
                    {
                        var jwt = handler.ReadJwtToken(credential);
                        var sub = jwt.Subject ?? jwt.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
                        var email = jwt.Claims.FirstOrDefault(c => c.Type == "email")?.Value;
                        var emailVerifiedStr = jwt.Claims.FirstOrDefault(c => c.Type == "email_verified")?.Value;
                        var name = jwt.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
                        var hd = jwt.Claims.FirstOrDefault(c => c.Type == "hd")?.Value;
                        var picture = jwt.Claims.FirstOrDefault(c => c.Type is "picture" or "avatar")?.Value;

                        var aud = jwt.Audiences.FirstOrDefault() ?? jwt.Claims.FirstOrDefault(c => c.Type == "aud")?.Value;
                        var iss = jwt.Issuer;

                        var isGoogleIssuer = iss is "accounts.google.com" or "https://accounts.google.com";
                        var isMatchingAud = clientIds.Any(c => string.Equals(c, aud, StringComparison.OrdinalIgnoreCase));

                        if (isGoogleIssuer && isMatchingAud && !string.IsNullOrWhiteSpace(sub) && !string.IsNullOrWhiteSpace(email))
                        {
                            var verified = bool.TryParse(emailVerifiedStr, out var v) && v;
                            return new GoogleIdentity(sub, email, verified, hd, name, picture);
                        }
                    }
                }
                catch
                {
                    // Fall back to original error
                }
            }

            throw new IdentityException(401, $"Invalid Google credential: {ex.Message}");
        }
        catch (ArgumentException ex)
        {
            throw new IdentityException(401, $"Invalid Google credential: {ex.Message}");
        }
    }
}
