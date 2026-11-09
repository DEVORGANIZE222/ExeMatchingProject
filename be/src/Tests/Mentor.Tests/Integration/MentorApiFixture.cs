using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using EXETeamMatching.Messaging.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Xunit;

namespace EXETeamMatching.Mentor.Tests.Integration;

/// <summary>
/// Integration tests: real Mentor.Api pipeline (routing, JWT auth, controllers, service, EF repository)
/// against a throwaway PostgreSQL database. They run only when TEST_POSTGRES_CONNECTION is set
/// (a server connection string with CREATE DATABASE rights); otherwise they are reported as skipped.
/// </summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(MentorApiFixture.ServerConnection))
            Skip = "Set TEST_POSTGRES_CONNECTION to run Mentor PostgreSQL integration tests.";
    }
}

[CollectionDefinition(Name)]
public sealed class MentorApiCollection : ICollectionFixture<MentorApiFixture>
{
    public const string Name = "Mentor API (PostgreSQL)";
}

public sealed class MentorApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string JwtSecret = "TEST-ONLY-SIGNING-KEY-MENTOR-SERVICE-2026";
    private const string Issuer = "EXETeamMatching";
    private const string Audience = "EXETeamMatchingClients";

    public static readonly string? ServerConnection = Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION");

    private readonly string _databaseName = "mentor_test_" + Guid.NewGuid().ToString("N");
    private bool _databaseCreated;

    public string DatabaseConnection => new NpgsqlConnectionStringBuilder(ServerConnection) { Database = _databaseName }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        // Program.cs reads these before builder.Build(), so they must be host settings
        // (ConfigureAppConfiguration is applied too late for minimal-hosting top-level reads).
        builder.UseSetting("ConnectionStrings:DefaultConnection", DatabaseConnection);
        builder.UseSetting("JwtSettings:Secret", JwtSecret);
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IEventPublisher>();
            services.AddSingleton<IEventPublisher, NoOpEventPublisher>();
        });
    }

    public async Task InitializeAsync()
    {
        if (string.IsNullOrWhiteSpace(ServerConnection))
            return;
        await using var connection = new NpgsqlConnection(ServerConnection);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"CREATE DATABASE \"{_databaseName}\"", connection);
        await command.ExecuteNonQueryAsync();
        _databaseCreated = true;
        // Boots the host: runs the normal startup EnsureCreated + upgrade SQL against the new database.
        _ = Server;
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        if (!_databaseCreated)
            return;
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(ServerConnection);
        await connection.OpenAsync();
        // Only this fixture's generated database is ever removed.
        if (!_databaseName.StartsWith("mentor_test_", StringComparison.Ordinal))
            throw new InvalidOperationException();
        await using var command = new NpgsqlCommand($"DROP DATABASE \"{_databaseName}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
    }

    public HttpClient ClientFor(string? role, Guid? userId = null)
    {
        var client = CreateClient();
        if (role is not null)
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateToken(role, userId ?? Guid.NewGuid()));
        return client;
    }

    public async Task WithDbAsync(Func<MentorDbContext, Task> action)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MentorDbContext>();
        await action(db);
    }

    public async Task<T> WithDbAsync<T>(Func<MentorDbContext, Task<T>> action)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MentorDbContext>();
        return await action(db);
    }

    private static string CreateToken(string role, Guid userId)
    {
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            Issuer,
            Audience,
            [new Claim("sub", userId.ToString()), new Claim("role", role), new Claim("ver", "1")],
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private sealed class NoOpEventPublisher : IEventPublisher
    {
        public Task PublishAsync<TEvent>(string topic, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class => Task.CompletedTask;
        public Task PublishAsync<TEvent>(string topic, string key, TEvent @event, CancellationToken cancellationToken = default) where TEvent : class => Task.CompletedTask;
        public Task PublishRawAsync(string topic, string key, string payload, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
