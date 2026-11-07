using System.Net.Http.Headers;
using System.Net.Http.Json;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Xunit;

namespace EXETeamMatching.IdentitySemester.Tests;

public sealed class IdentityApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminEmail = "admin@identity.test";
    public const string Password = "Test-only-password-2026!";
    public const string JwtSecret = "TEST-ONLY-SIGNING-KEY-IDENTITY-SEMESTER-2026";
    private readonly string databaseName = "identity_test_" + Guid.NewGuid().ToString("N");
    private readonly string serverConnection = Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION")
        ?? "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres";
    public HttpClient Admin { get; private set; } = null!;
    public FakeGoogleIdTokenValidator Google { get; } = new();
    private bool databaseCreated;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var connection = new NpgsqlConnectionStringBuilder(serverConnection) { Database = databaseName };
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connection.ConnectionString,
            ["JwtSettings:Secret"] = JwtSecret,
            ["BootstrapAdmin:Email"] = AdminEmail,
            ["BootstrapAdmin:Password"] = Password,
            ["Outbox:Enabled"] = "false",
            ["Logging:LogLevel:Default"] = "Warning"
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IGoogleIdTokenValidator>();
            services.AddSingleton<IGoogleIdTokenValidator>(Google);
        });
    }
    public async Task InitializeAsync()
    {
        await using var connection = new NpgsqlConnection(serverConnection);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
        databaseCreated = true;
        Admin = CreateClient();
        await SignIn(Admin, AdminEmail, Password);
    }
    public static async Task<LoginResponse> SignIn(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        response.EnsureSuccessStatusCode();
        var login = (await response.Content.ReadFromJsonAsync<ApiResponse<LoginResponse>>())!.Data!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);
        return login;
    }
    async Task IAsyncLifetime.DisposeAsync()
    {
        Admin?.Dispose();
        await base.DisposeAsync();
        if (!databaseCreated) return;
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(serverConnection);
        await connection.OpenAsync();
        // Only this fixture's generated database is ever removed.
        if (!databaseName.StartsWith("identity_test_", StringComparison.Ordinal)) throw new InvalidOperationException();
        await using var command = new NpgsqlCommand($"DROP DATABASE \"{databaseName}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
    }
}

public sealed class FakeGoogleIdTokenValidator : IGoogleIdTokenValidator
{
    public const string AllowedCredential = "valid-google-id-token-for-nhanlhse184226";
    public const string ExistingAccountCredential = "valid-google-id-token-for-existing-user";
    public const string UnverifiedCredential = "valid-google-id-token-unverified";
    public const string DeniedCredential = "valid-google-id-token-not-whitelisted";
    public Task<GoogleIdentity> ValidateAsync(string credential, CancellationToken ct) => credential switch
    {
        AllowedCredential => Task.FromResult(new GoogleIdentity("google-subject-1", "nhanlhse184226@fpt.edu.vn", true, "fpt.edu.vn", "Nhan Le", "https://lh3.googleusercontent.com/test-avatar")),
        ExistingAccountCredential => Task.FromResult(new GoogleIdentity("google-subject-2", "existing@student.test", true, "fpt.edu.vn", "Existing Student")),
        UnverifiedCredential => Task.FromResult(new GoogleIdentity("google-subject-3", "nhanlhse184226@fpt.edu.vn", false, "fpt.edu.vn", "Unverified")),
        DeniedCredential => Task.FromResult(new GoogleIdentity("google-subject-4", "not-allowed@fpt.edu.vn", true, "fpt.edu.vn", "Denied")),
        _ => throw new IdentityException(401, "Invalid Google credential.")
    };
    public bool IsAllowedEmail(string email) => string.Equals(email, "nhanlhse184226@fpt.edu.vn", StringComparison.OrdinalIgnoreCase)
        || string.Equals(email, "existing@student.test", StringComparison.OrdinalIgnoreCase);
}
