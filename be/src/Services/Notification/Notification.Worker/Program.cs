using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.Notification.Application.Interfaces;
using EXETeamMatching.Notification.Infrastructure.Services;
using EXETeamMatching.Notification.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        services.Configure<KafkaSettings>(context.Configuration.GetSection("KafkaSettings"));
        services.Configure<EmailSettings>(context.Configuration.GetSection("EmailSettings"));

        services.AddSingleton<IDeduplicationService, InMemoryDeduplicationService>();
        services.AddSingleton<INotificationStore, InMemoryNotificationStore>();
        services.AddSingleton<IEmailService, EmailService>();
        services.AddSingleton<INotificationService, NotificationHandler>();
        services.AddSingleton<IKafkaConsumer, KafkaConsumer>();

        services.AddHostedService<Worker>();
    })
    .Build();

await host.RunAsync();
