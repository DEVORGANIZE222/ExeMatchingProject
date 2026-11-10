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
using EXETeamMatching.SharedKernel.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
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

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
                       ?? builder.Configuration["DATABASE_CONNECTION_STRING"];

builder.Services.AddDbContext<MentorDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddHttpClient(MentorService.GroupsClientName, client =>
{
    client.BaseAddress = new Uri(builder.Configuration["GroupMatching:BaseUrl"] ?? "http://localhost:5002/");
});
builder.Services.AddHttpClient(MentorService.IdentityClientName, client =>
{
    client.BaseAddress = new Uri(builder.Configuration["IdentitySemester:BaseUrl"] ?? "http://localhost:5001/");
});

builder.Services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
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
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<MentorDbContext>();
        await dbContext.Database.EnsureCreatedAsync();
        if (dbContext.Database.IsNpgsql())
        {
            await dbContext.Database.ExecuteSqlRawAsync("""
                ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "RequesterUserId" uuid NULL;
                ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "RequesterName" character varying(200) NOT NULL DEFAULT '';
                ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "GroupName" character varying(200) NOT NULL DEFAULT '';
                ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "Topic" character varying(1000) NOT NULL DEFAULT '';
                ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "DecisionReason" character varying(2000) NULL;
                ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "DecidedAt" timestamp with time zone NULL;
                ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamp with time zone NULL;
                ALTER TABLE "Mentors" ADD COLUMN IF NOT EXISTS "Phone" character varying(40) NOT NULL DEFAULT '';
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_MentorRequests_GroupId"
                    ON "MentorRequests" ("GroupId") WHERE "Status" = 0;
                CREATE TABLE IF NOT EXISTS "MentorGroupProgress" (
                    "Id" uuid PRIMARY KEY,
                    "MentorId" uuid NOT NULL,
                    "GroupId" uuid NOT NULL,
                    "GroupName" character varying(200) NOT NULL,
                    "Topic" character varying(1000) NOT NULL,
                    "Milestone" character varying(200) NOT NULL,
                    "Progress" integer NOT NULL,
                    "Feedback" character varying(2000) NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_MentorGroupProgress_MentorId_GroupId"
                    ON "MentorGroupProgress" ("MentorId", "GroupId");
                CREATE TABLE IF NOT EXISTS "MentorAppointments" (
                    "Id" uuid PRIMARY KEY,
                    "MentorId" uuid NOT NULL,
                    "GroupId" uuid NULL,
                    "Title" character varying(200) NOT NULL,
                    "StartsAt" timestamp with time zone NOT NULL,
                    "Notes" character varying(2000) NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NULL
                );
                CREATE TABLE IF NOT EXISTS "MentorNotifications" (
                    "Id" uuid PRIMARY KEY,
                    "MentorId" uuid NOT NULL,
                    "Type" character varying(40) NOT NULL,
                    "Title" character varying(200) NOT NULL,
                    "Message" character varying(1000) NOT NULL,
                    "IsRead" boolean NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NULL
                );
                CREATE TABLE IF NOT EXISTS "StudentNotifications" (
                    "Id" uuid PRIMARY KEY,
                    "GroupId" uuid NOT NULL,
                    "RequestId" uuid NULL,
                    "MentorName" character varying(200) NOT NULL DEFAULT '',
                    "GroupName" character varying(200) NOT NULL DEFAULT '',
                    "Type" character varying(40) NOT NULL,
                    "Title" character varying(200) NOT NULL,
                    "Message" character varying(2500) NOT NULL,
                    "IsRead" boolean NOT NULL,
                    "CreatedAt" timestamp with time zone NOT NULL,
                    "UpdatedAt" timestamp with time zone NULL
                );
                CREATE INDEX IF NOT EXISTS "IX_StudentNotifications_GroupId_CreatedAt"
                    ON "StudentNotifications" ("GroupId", "CreatedAt" DESC);
                CREATE INDEX IF NOT EXISTS "IX_StudentNotifications_RequestId"
                    ON "StudentNotifications" ("RequestId");
                INSERT INTO "StudentNotifications" (
                    "Id", "GroupId", "RequestId", "MentorName", "GroupName",
                    "Type", "Title", "Message", "IsRead", "CreatedAt", "UpdatedAt"
                )
                SELECT
                    r."Id",
                    r."GroupId",
                    r."Id",
                    LEFT(m."FullName", 200),
                    LEFT(r."GroupName", 200),
                    CASE WHEN r."Status" = 1 THEN 'decision-approved' ELSE 'decision-rejected' END,
                    LEFT(CASE
                        WHEN r."Status" = 1 THEN 'GVHD ' || m."FullName" || ' đã chấp thuận hướng dẫn'
                        ELSE 'GVHD ' || m."FullName" || ' đã từ chối lời mời'
                    END, 200),
                    LEFT(CASE
                        WHEN r."Status" = 1 AND NULLIF(BTRIM(COALESCE(r."DecisionReason", '')), '') IS NOT NULL
                            THEN 'Lời nhắn từ giảng viên: ' || BTRIM(r."DecisionReason")
                        WHEN r."Status" = 1
                            THEN 'Giảng viên ' || m."FullName" || ' đã đồng ý hướng dẫn nhóm ' || r."GroupName" || '.'
                        WHEN NULLIF(BTRIM(COALESCE(r."DecisionReason", '')), '') IS NOT NULL
                            THEN 'Lý do từ chối: ' || BTRIM(r."DecisionReason")
                        ELSE 'Giảng viên ' || m."FullName" || ' đã từ chối yêu cầu hướng dẫn của nhóm ' || r."GroupName" || '.'
                    END, 2500),
                    false,
                    COALESCE(r."DecidedAt", r."UpdatedAt", r."CreatedAt"),
                    NULL
                FROM "MentorRequests" r
                JOIN "Mentors" m ON m."Id" = r."MentorId"
                WHERE r."Status" IN (1, 2)
                  AND NOT EXISTS (
                      SELECT 1 FROM "StudentNotifications" sn WHERE sn."RequestId" = r."Id"
                  );
                """);
        }
    }
}

app.UseMiddleware<GlobalExceptionHandler>();
app.UseCors("AllowAll");


app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Mentor API v1");
    c.RoutePrefix = string.Empty;
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGrpcService<MentorGrpcServiceImpl>();

app.Run();

// Exposes the entry point to WebApplicationFactory-based integration tests.
public partial class Program { }
