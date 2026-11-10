using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.Notification.Application.Interfaces;
using EXETeamMatching.Notification.Infrastructure.Services;
using EXETeamMatching.Notification.Worker;

var builder = WebApplication.CreateBuilder(args);

var rawPort = Environment.GetEnvironmentVariable("PORT") ?? builder.Configuration["PORT"];
var port = int.TryParse(rawPort?.Trim(), out var parsedPort) && parsedPort > 0 ? parsedPort : 8080;
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.Configure<KafkaSettings>(builder.Configuration.GetSection("KafkaSettings"));
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));

builder.Services.AddSingleton<IDeduplicationService, InMemoryDeduplicationService>();
builder.Services.AddSingleton<INotificationStore, InMemoryNotificationStore>();
builder.Services.AddSingleton<IEmailService, EmailService>();
builder.Services.AddSingleton<INotificationService, NotificationHandler>();
builder.Services.AddSingleton<IKafkaConsumer, KafkaConsumer>();

builder.Services.AddHostedService<Worker>();

var app = builder.Build();

app.MapGet("/", () => Results.Ok(new { status = "Healthy", service = "NotificationWorker" }));
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", service = "NotificationWorker" }));

await app.RunAsync();
