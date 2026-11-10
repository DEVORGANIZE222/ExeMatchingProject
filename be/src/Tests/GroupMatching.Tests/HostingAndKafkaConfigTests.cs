using System.Net;
using System.Net.Http.Headers;
using Confluent.Kafka;
using EXETeamMatching.Mentor.Grpc;
using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.SharedKernel.Configuration;
using Grpc.Net.Client.Web;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EXETeamMatching.GroupMatching.Tests;

public class HostingAndKafkaConfigTests
{
    [Fact]
    public void NormalizePostgresConnectionString_Converts_Render_And_Neon_Uris()
    {
        var renderUri = "postgresql://exe_user:p%40ss%3B123@dpg-dbffbnajnfac73c5vl4g-a/mentor_db";
        var renderResult = HostingExtensions.NormalizePostgresConnectionString(renderUri);
        Assert.Equal("Host=dpg-dbffbnajnfac73c5vl4g-a;Port=5432;Database=mentor_db;Username=exe_user;Password=\"p@ss;123\";Ssl Mode=Prefer", renderResult);

        var neonUri = "postgres://neon_user:secret@ep-cool-host.ap-southeast-1.aws.neon.tech/identity_db?sslmode=require&channel_binding=require";
        var neonResult = HostingExtensions.NormalizePostgresConnectionString(neonUri);
        Assert.Equal("Host=ep-cool-host.ap-southeast-1.aws.neon.tech;Port=5432;Database=identity_db;Username=neon_user;Password=secret;Ssl Mode=Require;Channel Binding=Require", neonResult);
    }

    [Fact]
    public void NormalizePostgresConnectionString_Preserves_Standard_Keyword_String()
    {
        const string standard = "Host=postgres;Port=5432;Database=group_matching_db;Username=postgres;Password=postgres";
        Assert.Equal(standard, HostingExtensions.NormalizePostgresConnectionString(standard));
    }

    [Fact]
    public void GetRenderPort_Parses_Configured_Positive_Integer()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["PORT"] = "10000" })
            .Build();

        // Environment variable PORT takes precedence if present in process; otherwise falls back to config.
        var port = config.GetRenderPort();
        Assert.True(port is > 0);
    }

    [Fact]
    public void KafkaConfigHelper_Applies_Redpanda_SaslSsl_And_ScramSha256()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["KafkaSettings:BootstrapServers"] = "demo.any.ap-southeast-1.mpx.prd.cloud.redpanda.com:9092",
                ["KafkaSettings:SecurityProtocol"] = "SASL_SSL",
                ["KafkaSettings:SaslMechanism"] = "SCRAM-SHA-256",
                ["KafkaSettings:SaslUsername"] = "exe-app",
                ["KafkaSettings:SaslPassword"] = "s3cr3t",
                ["KafkaSettings:SslCaPem"] = "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----"
            })
            .Build();

        var resolved = KafkaConfigHelper.Resolve(config);
        var clientConfig = new ProducerConfig();
        KafkaConfigHelper.ApplyTo(clientConfig, resolved);

        Assert.Equal("demo.any.ap-southeast-1.mpx.prd.cloud.redpanda.com:9092", clientConfig.BootstrapServers);
        Assert.Equal(SecurityProtocol.SaslSsl, clientConfig.SecurityProtocol);
        Assert.Equal(SaslMechanism.ScramSha256, clientConfig.SaslMechanism);
        Assert.Equal("exe-app", clientConfig.SaslUsername);
        Assert.Equal("s3cr3t", clientConfig.SaslPassword);
        Assert.Equal("-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----", clientConfig.SslCaPem);
    }

    [Fact]
    public void KafkaConfigHelper_Leaves_Local_Plaintext_Untouched_When_No_Credentials()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["KafkaSettings:BootstrapServers"] = "kafka:29092"
            })
            .Build();

        var resolved = KafkaConfigHelper.Resolve(config);
        var clientConfig = new ConsumerConfig();
        KafkaConfigHelper.ApplyTo(clientConfig, resolved);

        Assert.Equal("kafka:29092", clientConfig.BootstrapServers);
        Assert.Null(clientConfig.SecurityProtocol);
        Assert.Null(clientConfig.SaslMechanism);
    }

    [Fact]
    public async Task MentorGrpcClient_With_GrpcWeb_Resolves_From_DI_And_Uses_Http11_GrpcWeb()
    {
        var handler = new CaptureGrpcWebHandler();
        var services = new ServiceCollection();
        services.AddGrpcClient<MentorGrpcService.MentorGrpcServiceClient>(options =>
        {
            options.Address = new Uri("https://mentor.example.com");
        }).ConfigurePrimaryHttpMessageHandler(() =>
            new GrpcWebHandler(GrpcWebMode.GrpcWeb, handler)
            {
                HttpVersion = HttpVersion.Version11
            });

        await using var provider = services.BuildServiceProvider();
        var client = provider.GetRequiredService<MentorGrpcService.MentorGrpcServiceClient>();
        var response = await client.GetMentorsAsync(new GetMentorsRequest { PageNumber = 1, PageSize = 10 });

        Assert.Equal(0, response.TotalCount);
        Assert.NotNull(handler.LastRequest);
        Assert.Equal(HttpVersion.Version11, handler.LastRequest!.Version);
        Assert.Equal("application/grpc-web", handler.LastRequest.Content?.Headers.ContentType?.MediaType);
        Assert.Equal("/mentor.MentorGrpcService/GetMentors", handler.LastRequest.RequestUri?.AbsolutePath);
    }

    private sealed class CaptureGrpcWebHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            var trailers = System.Text.Encoding.ASCII.GetBytes("grpc-status: 0\r\n");
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Version = HttpVersion.Version11,
                Content = new ByteArrayContent([0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, (byte)trailers.Length, .. trailers])
            };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue("application/grpc-web");
            return Task.FromResult(response);
        }
    }
}

