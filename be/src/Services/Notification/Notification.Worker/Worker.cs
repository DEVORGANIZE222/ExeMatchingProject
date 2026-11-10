using EXETeamMatching.Notification.Application.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace EXETeamMatching.Notification.Worker;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly IKafkaConsumer _kafkaConsumer;

    public Worker(ILogger<Worker> logger, IKafkaConsumer kafkaConsumer)
    {
        _logger = logger;
        _kafkaConsumer = kafkaConsumer;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Yield immediately so ASP.NET Core Kestrel binds the HTTP /health port before Kafka polling starts.
        await Task.Yield();

        _logger.LogInformation("Notification Background Worker Service started at: {Time}", DateTimeOffset.Now);

        try
        {
            await _kafkaConsumer.StartConsumingAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Notification Background Worker Service gracefully stopped at: {Time}", DateTimeOffset.Now);
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Notification Background Worker Service terminated unexpectedly.");
            throw;
        }
    }
}
