FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Directory.Build.props", "./"]
COPY ["proto/mentor.proto", "proto/"]
COPY ["src/BuildingBlocks/SharedKernel/SharedKernel.csproj", "src/BuildingBlocks/SharedKernel/"]
COPY ["src/BuildingBlocks/Contracts/Contracts.csproj", "src/BuildingBlocks/Contracts/"]
COPY ["src/BuildingBlocks/Messaging/Messaging.csproj", "src/BuildingBlocks/Messaging/"]
COPY ["src/Services/Mentor/Mentor.Domain/Mentor.Domain.csproj", "src/Services/Mentor/Mentor.Domain/"]
COPY ["src/Services/Mentor/Mentor.Application/Mentor.Application.csproj", "src/Services/Mentor/Mentor.Application/"]
COPY ["src/Services/Mentor/Mentor.Infrastructure/Mentor.Infrastructure.csproj", "src/Services/Mentor/Mentor.Infrastructure/"]
COPY ["src/Services/Mentor/Mentor.Grpc/Mentor.Grpc.csproj", "src/Services/Mentor/Mentor.Grpc/"]
COPY ["src/Services/Mentor/Mentor.Api/Mentor.Api.csproj", "src/Services/Mentor/Mentor.Api/"]

RUN dotnet restore "src/Services/Mentor/Mentor.Api/Mentor.Api.csproj"

COPY . .
WORKDIR "/src/src/Services/Mentor/Mentor.Api"
RUN dotnet build "Mentor.Api.csproj" -c Release -o /app/build
RUN dotnet publish "Mentor.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
EXPOSE 8080
EXPOSE 50051
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Mentor.Api.dll"]
