using System.Text;
using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.Messaging.Implementations;
using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.Mentor.Application.Interfaces;
using EXETeamMatching.Mentor.Application.Services;
using EXETeamMatching.Mentor.Grpc.Services;
using EXETeamMatching.Mentor.Api.Controllers;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using EXETeamMatching.Mentor.Infrastructure.Repositories;
using EXETeamMatching.SharedKernel.Configuration;
using EXETeamMatching.SharedKernel.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

var renderPort = builder.Configuration.GetRenderPort();
builder.WebHost.ConfigureKestrel(options =>
{
    if (renderPort is { } port)
    {
        // Render terminates TLS at its edge proxy and forwards HTTP/1.1 to $PORT;
        // both REST controllers and gRPC-Web share this single endpoint.
        options.ListenAnyIP(port, endpoint => endpoint.Protocols = HttpProtocols.Http1);
        return;
    }

    options.ListenAnyIP(8080, endpoint => endpoint.Protocols = HttpProtocols.Http1);
    options.ListenAnyIP(50051, endpoint => endpoint.Protocols = HttpProtocols.Http2);
});

builder.Services.AddControllers();
builder.Services.AddGrpc();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Mentor API", Version = "v1" });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod()
              .WithExposedHeaders(
                  MentorsController.TotalCountHeader,
                  MentorsController.PageIndexHeader,
                  MentorsController.PageSizeHeader,
                  MentorsController.TotalPagesHeader);
    });
});

builder.Services.Configure<KafkaSettings>(builder.Configuration.GetSection("KafkaSettings"));

var jwtSecret = builder.Configuration["JwtSettings:Secret"] ?? string.Empty;
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "EXETeamMatching";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "EXETeamMatchingClients";
if (Encoding.UTF8.GetByteCount(jwtSecret) < 32)
    throw new InvalidOperationException("JWT requires a secret of at least 32 bytes.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        RequireExpirationTime = true,
        ValidateIssuerSigningKey = true,
        RequireSignedTokens = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        NameClaimType = "sub",
        RoleClaimType = "role",
        ClockSkew = TimeSpan.FromSeconds(30)
    };
});
builder.Services.AddAuthorization();

builder.Services.AddDbContext<MentorDbContext>((sp, options) =>
    options.UseNpgsql(sp.GetRequiredService<IConfiguration>().ResolvePostgresConnectionString()));
builder.Services.AddHttpClient(MentorService.GroupsClientName, client =>
{
    client.BaseAddress = new Uri(builder.Configuration["GroupMatching:BaseUrl"] ?? "http://localhost:5002/");
});
builder.Services.AddHttpClient(MentorService.IdentityClientName, client =>
{
    client.BaseAddress = new Uri(builder.Configuration["IdentitySemester:BaseUrl"] ?? "http://localhost:5001/");
});

builder.Services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
builder.Services.AddScoped<MentorDatabaseInitializer>();
builder.Services.AddScoped<IMentorRepository, MentorRepository>();
builder.Services.AddScoped<MentorService>();
builder.Services.AddScoped<IMentorService>(sp => sp.GetRequiredService<MentorService>());
builder.Services.AddScoped<IMentorQuotaService>(sp => sp.GetRequiredService<MentorService>());

var app = builder.Build();

// Set only by the build-time OpenAPI export (Mentor.Api.csproj): the Swashbuckle CLI loads this
// host to read the Swagger document and must not touch the database.
var openApiExportOnly = app.Configuration.GetValue<bool>("OpenApi:ExportOnly");

if (!openApiExportOnly)
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<MentorDatabaseInitializer>().Initialize();
}

app.UseMiddleware<GlobalExceptionHandler>();
app.UseRouting();
app.UseCors("AllowAll");
app.UseGrpcWeb();


app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Mentor API v1");
    c.RoutePrefix = string.Empty;
});

app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "Mentor" })).AllowAnonymous();
app.MapControllers();
app.MapGrpcService<MentorGrpcServiceImpl>().EnableGrpcWeb();

app.Run();

// Exposes the entry point to WebApplicationFactory-based integration tests.
public partial class Program { }
