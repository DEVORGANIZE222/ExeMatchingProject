FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Directory.Build.props", "./"]
COPY ["src/BuildingBlocks/Contracts/Contracts.csproj", "src/BuildingBlocks/Contracts/"]
COPY ["src/BuildingBlocks/Messaging/Messaging.csproj", "src/BuildingBlocks/Messaging/"]
COPY ["src/Services/Notification/Notification.Application/Notification.Application.csproj", "src/Services/Notification/Notification.Application/"]
COPY ["src/Services/Notification/Notification.Infrastructure/Notification.Infrastructure.csproj", "src/Services/Notification/Notification.Infrastructure/"]
COPY ["src/Services/Notification/Notification.Worker/Notification.Worker.csproj", "src/Services/Notification/Notification.Worker/"]

RUN dotnet restore "src/Services/Notification/Notification.Worker/Notification.Worker.csproj"

COPY . .
WORKDIR "/src/src/Services/Notification/Notification.Worker"
RUN dotnet build "Notification.Worker.csproj" -c Release -o /app/build
RUN dotnet publish "Notification.Worker.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/runtime:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Notification.Worker.dll"]
