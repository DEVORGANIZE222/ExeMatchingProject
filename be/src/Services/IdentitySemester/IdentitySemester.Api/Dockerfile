FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Directory.Build.props", "./"]
COPY ["src/BuildingBlocks/SharedKernel/SharedKernel.csproj", "src/BuildingBlocks/SharedKernel/"]
COPY ["src/BuildingBlocks/Contracts/Contracts.csproj", "src/BuildingBlocks/Contracts/"]
COPY ["src/BuildingBlocks/Messaging/Messaging.csproj", "src/BuildingBlocks/Messaging/"]
COPY ["src/Services/IdentitySemester/IdentitySemester.Domain/IdentitySemester.Domain.csproj", "src/Services/IdentitySemester/IdentitySemester.Domain/"]
COPY ["src/Services/IdentitySemester/IdentitySemester.Application/IdentitySemester.Application.csproj", "src/Services/IdentitySemester/IdentitySemester.Application/"]
COPY ["src/Services/IdentitySemester/IdentitySemester.Infrastructure/IdentitySemester.Infrastructure.csproj", "src/Services/IdentitySemester/IdentitySemester.Infrastructure/"]
COPY ["src/Services/IdentitySemester/IdentitySemester.Api/IdentitySemester.Api.csproj", "src/Services/IdentitySemester/IdentitySemester.Api/"]

RUN dotnet restore "src/Services/IdentitySemester/IdentitySemester.Api/IdentitySemester.Api.csproj"

COPY . .
WORKDIR "/src/src/Services/IdentitySemester/IdentitySemester.Api"
RUN dotnet build "IdentitySemester.Api.csproj" -c Release -o /app/build
RUN dotnet publish "IdentitySemester.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "IdentitySemester.Api.dll"]
