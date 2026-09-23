using EXETeamMatching.GroupMatching.Infrastructure.Persistence;
using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.Messaging.Implementations;
using EXETeamMatching.Messaging.Settings;
using EXETeamMatching.SharedKernel.Middleware;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "GroupMatching API", Version = "v1" });
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

builder.Services.AddSingleton<IEventPublisher, KafkaEventPublisher>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<GroupMatchingDbContext>();
    dbContext.Database.EnsureCreated();
}

app.UseMiddleware<GlobalExceptionHandler>();
app.UseCors("AllowAll");


app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "GroupMatching API v1");
    c.RoutePrefix = string.Empty;
});

app.UseAuthorization();
app.MapControllers();

app.Run();
