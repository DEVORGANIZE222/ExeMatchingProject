using System.Text;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.IdentitySemester.Infrastructure.Persistence;
using EXETeamMatching.IdentitySemester.Infrastructure.Services;
using EXETeamMatching.IdentitySemester.Api;
using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.SharedKernel.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
if (builder.Configuration.GetRenderPort() is { } renderPort)
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
}
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "IdentitySemester API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>()
    });
});

builder.Services.AddOptions<JwtSettings>().Bind(builder.Configuration.GetSection("JwtSettings"))
    .Validate(s => Encoding.UTF8.GetByteCount(s.Secret) >= 32 && !string.IsNullOrWhiteSpace(s.Issuer)
        && !string.IsNullOrWhiteSpace(s.Audience) && s.ExpirationInMinutes is >= 1 and <= 1440,
        "JWT requires a secret of at least 32 bytes, issuer, audience and expiry between 1 and 1440 minutes.")
    .ValidateOnStart();
builder.Services.AddOptions<GoogleAuthSettings>().Bind(builder.Configuration.GetSection("GoogleAuth"));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    var jwt = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>() ?? new JwtSettings();
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = jwt.Issuer,
        ValidateAudience = true, ValidAudience = jwt.Audience,
        ValidateLifetime = true, RequireExpirationTime = true,
        ValidateIssuerSigningKey = true, RequireSignedTokens = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        NameClaimType = "sub", RoleClaimType = "role", ClockSkew = TimeSpan.FromSeconds(30)
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var store = context.HttpContext.RequestServices.GetRequiredService<IIdentityStore>();
            if (!Guid.TryParse(context.Principal?.FindFirst("sub")?.Value, out var id))
            { context.Fail("Invalid subject."); return; }
            var user = await store.UserById(id, context.HttpContext.RequestAborted);
            if (user is null || context.Principal?.FindFirst("ver")?.Value != user.TokenVersion.ToString()
                || context.Principal?.FindFirst("role")?.Value != user.Role.Name)
                context.Fail("Account or token is no longer valid.");
        }
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("MentorTeamContacts", policy =>
        policy.RequireRole("Mentor")
            .RequireClaim("scope", "mentor-team-contacts")
            .RequireClaim("group_id"));
});
builder.Services.Configure<KafkaSettings>(builder.Configuration.GetSection("KafkaSettings"));
builder.Services.AddDbContext<IdentitySemesterDbContext>((sp, options) =>
    options.UseNpgsql(sp.GetRequiredService<IConfiguration>().ResolvePostgresConnectionString()));
builder.Services.AddScoped<IIdentityStore, IdentityRepository>();
builder.Services.AddScoped<IdentityService>();
builder.Services.AddScoped<IAuthenticationService>(sp => sp.GetRequiredService<IdentityService>());
builder.Services.AddSingleton<IPasswordService, PasswordService>();
builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton<ITokenIssuer>(sp => sp.GetRequiredService<JwtService>());
builder.Services.AddSingleton<IJwtService>(sp => sp.GetRequiredService<JwtService>());
builder.Services.AddSingleton<IGoogleIdTokenValidator, GoogleIdTokenValidator>();
builder.Services.AddSingleton<IStudentImportReader, StudentImportReader>();
builder.Services.AddSingleton<IGoogleEmailImportReader, GoogleEmailImportReader>();
builder.Services.AddScoped<DatabaseInitializer>();
builder.Services.AddHostedService<StudentOutboxPublisher>();
builder.Services.AddHostedService<GroupMembershipConsumer>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();
using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().Initialize();

app.UseMiddleware<IdentityErrorHandler>();
app.UseCors("AllowAll");
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "IdentitySemester API v1");
    c.RoutePrefix = string.Empty;
});
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "IdentitySemester" })).AllowAnonymous();
app.MapControllers();
app.Run();

public partial class Program { }
