using EXETeamMatching.GroupMatching.Infrastructure.Persistence;
using EXETeamMatching.GroupMatching.Api;
using EXETeamMatching.GroupMatching.Infrastructure.Services;
using EXETeamMatching.GroupMatching.Api.Clients;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Application.Services;
using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.Messaging.Implementations;
using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.SharedKernel.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

AppContext.SetSwitch("System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport", true);

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "GroupMatching API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement { [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>() });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.Configure<KafkaSettings>(builder.Configuration.GetSection("KafkaSettings"));

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
                       ?? builder.Configuration["DATABASE_CONNECTION_STRING"];

builder.Services.AddDbContext<GroupMatchingDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddScoped<GroupDatabaseInitializer>();

builder.Services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
builder.Services.AddScoped<IGroupRepository, GroupRepository>();
builder.Services.AddScoped<IGroupService, GroupService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<IMentorRecommendationService, MentorRecommendationService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IRequestAccessToken, RequestAccessToken>();
builder.Services.AddHttpClient<IIdentitySemesterClient, IdentitySemesterClient>(client =>
    client.BaseAddress = new Uri(builder.Configuration["IdentitySemester:BaseUrl"] ?? "http://identity-semester:8080/"));
builder.Services.AddGrpcClient<EXETeamMatching.Mentor.Grpc.MentorGrpcService.MentorGrpcServiceClient>(client =>
    client.Address = new Uri(builder.Configuration["MentorGrpc:Address"] ?? "http://mentor:50051"));
builder.Services.AddScoped<IMentorRecommendationClient, MentorGrpcRecommendationClient>();
var jwt = builder.Configuration.GetSection("JwtSettings");
var secret = jwt["Secret"] ?? string.Empty;
if (Encoding.UTF8.GetByteCount(secret) < 32)
    throw new InvalidOperationException("JwtSettings:Secret must be at least 32 bytes.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidIssuer = jwt["Issuer"], ValidateAudience = true, ValidAudience = jwt["Audience"],
        ValidateLifetime = true, RequireExpirationTime = true, ValidateIssuerSigningKey = true, RequireSignedTokens = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        NameClaimType = "sub", RoleClaimType = "role", ClockSkew = TimeSpan.FromSeconds(30)
    };
});
builder.Services.AddAuthorization();
builder.Services.AddHostedService<GroupOutboxPublisher>();
builder.Services.AddHostedService<GroupOutboxCleanupWorker>();
builder.Services.AddHostedService<SemesterCodeChangedConsumer>();
builder.Services.AddHostedService<StudentStrengthRolesChangedConsumer>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<GroupDatabaseInitializer>().Initialize();
}

app.UseMiddleware<GroupErrorHandler>();
app.UseCors("AllowAll");


app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "GroupMatching API v1");
    c.RoutePrefix = string.Empty;
});

app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "GroupMatching" })).AllowAnonymous();
app.MapControllers();

app.Run();

public partial class Program { }
