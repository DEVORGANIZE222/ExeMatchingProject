FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Directory.Build.props", "./"]
COPY ["src/BuildingBlocks/SharedKernel/SharedKernel.csproj", "src/BuildingBlocks/SharedKernel/"]
COPY ["src/BuildingBlocks/Contracts/Contracts.csproj", "src/BuildingBlocks/Contracts/"]
COPY ["src/BuildingBlocks/Messaging/Messaging.csproj", "src/BuildingBlocks/Messaging/"]
COPY ["src/Services/GroupMatching/GroupMatching.Domain/GroupMatching.Domain.csproj", "src/Services/GroupMatching/GroupMatching.Domain/"]
COPY ["src/Services/GroupMatching/GroupMatching.Application/GroupMatching.Application.csproj", "src/Services/GroupMatching/GroupMatching.Application/"]
COPY ["src/Services/GroupMatching/GroupMatching.Infrastructure/GroupMatching.Infrastructure.csproj", "src/Services/GroupMatching/GroupMatching.Infrastructure/"]
COPY ["src/Services/GroupMatching/GroupMatching.Api/GroupMatching.Api.csproj", "src/Services/GroupMatching/GroupMatching.Api/"]

RUN dotnet restore "src/Services/GroupMatching/GroupMatching.Api/GroupMatching.Api.csproj"

COPY . .
WORKDIR "/src/src/Services/GroupMatching/GroupMatching.Api"
RUN dotnet build "GroupMatching.Api.csproj" -c Release -o /app/build
RUN dotnet publish "GroupMatching.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "GroupMatching.Api.dll"]
