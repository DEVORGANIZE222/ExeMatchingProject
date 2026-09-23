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
        _logger.LogInformation("Notification Worker Service running at: {time}", DateTimeOffset.Now);

        await _kafkaConsumer.StartConsumingAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            // TODO: Consume Kafka events
            await Task.Delay(5000, stoppingToken);
        }
    }
}
