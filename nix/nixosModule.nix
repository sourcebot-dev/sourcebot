self: {
  config,
  pkgs,
  lib ? pkgs.lib,
  ...
}:
with lib; let
  cfg = config.services.sourcebot;
in {
  options.services.sourcebot = {
    enable = mkEnableOption "Enable SourceBot";
    dataDir = mkOption {
      type = types.path;
      default = "/var/lib/sourcebot";
      description = "Root data directory for SourceBot";
    };
    package = lib.mkOption {
      type = types.package;
      default = self.packages.${pkgs.system}.sourcebot;
      description = "Package to use for sourcebot";
    };
    # Override default, based on DATA_DIR
    dataCacheDir = mkOption {
      type = types.path;
      default = "/var/cache/sourcebot";
      description = "Directory for SourceBot data cache";
    };
    envFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = "Environment file for additional settings";
    };

    logLevel = mkOption {
      type = types.enum ["debug" "info" "warn" "error"];
      default = "info";
      description = "SourceBot logging level";
    };
    authEnabled = mkOption {
      type = types.bool;
      default = true;
      description = "Enables authentication in SourceBot";
    };
    telemetryDisabled = mkOption {
      type = types.bool;
      default = true;
      description = "Disables telemetry collection in SourceBot";
    };
    openFirewall = mkOption {
      type = types.bool;
      default = true;
      description = "Open Firwall ports for SourceBot";
    };

    configPath = mkOption {
      type = types.str;
      description = "Path to the SourceBot configuration file";
    };
    port = mkOption {
      type = types.int;
      default = 7734;
      description = "TCP port for the SourceBot web server to listen on";
    };
    hostname = mkOption {
      type = types.str;
      default = "0.0.0.0";
      description = "Hostname or IP address for the SourceBot web server to bind to";
    };
    authUrl = mkOption {
      type = types.str;
      default = "http://${cfg.hostname}:${toString cfg.port}";
      description = "Hostname or IP address for the SourceBot web server to bind to";
    };
    redisPort = mkOption {
      type = types.int;
      default = 16379;
      description = "TCP port for the SourceBot Redis server to listen on";
    };
    databaseUrl = mkOption {
      type = types.nullOr types.str;
      default = "postgresql://sourcebot@localhost:${toString config.services.postgresql.settings.port}/sourcebot";
      description = "PostgreSQL connection URL for SourceBot. If not set, a local PostgreSQL server will be configured and used.";
    };
  };

  config = mkIf cfg.enable {
    # Create a dedicated system group for SourceBot
    users.groups.sourcebot = {};
    # Create a dedicated system user for SourceBot
    users.users.sourcebot = {
      isSystemUser = true;
      group = "sourcebot"; # primary group
      description = "Service account for SourceBot";
      home = cfg.dataDir;
      shell = "/run/current-system/sw/bin/false";
    };

    networking.firewall.allowedTCPPorts = mkIf cfg.openFirewall [cfg.port];
    # Enable redis using the existing NixOS module
    services.redis.servers.sourcebot = {
      enable = true;
      user = "sourcebot";
      port = cfg.redisPort;
    };

    # Enable Postgres for SourceBot with isolated data directory and database
    services.postgresql = {
      enable = true;
      enableTCPIP = true;
      ensureDatabases = ["sourcebot"];
      ensureUsers = [
        {
          name = "sourcebot";
          ensureDBOwnership = true;
        }
      ];
      # Allow connections from any container IP addresses
      authentication = mkBefore ''
        local sourcebot sourcebot trust
        host sourcebot sourcebot 127.0.0.1/32 trust
        host sourcebot sourcebot ::1/128 trust
      '';
    };

    # Create and own data directories
    systemd.tmpfiles.rules = [
      # ensure root data dir
      "d ${cfg.dataDir} 0755 sourcebot sourcebot -"
      # ensure cache dir
      "d ${cfg.dataCacheDir} 0755 sourcebot sourcebot -"
    ];

    # Zoekt search service
    systemd.services.sourcebot-zoekt = {
      description = "SourceBot Zoekt Search Service";
      after = ["network.target" "redis.service"];
      wants = ["redis.service"];
      serviceConfig = {
        # Run under the sourcebot user
        User = "sourcebot";
        Group = "sourcebot";
        ExecStart = "${pkgs.zoekt}/bin/zoekt-webserver -index ${cfg.dataCacheDir}/index -rpc";
        Restart = "on-failure";
        RestartSec = "5s";
        Environment = [
          "DATA_DIR=${cfg.dataDir}"
          "DATA_CACHE_DIR=${cfg.dataCacheDir}"
        ];
      };
    };

    systemd.services.sourcebot-db-setup = {
      description = "SourceBot Database setup";
      after = ["network.target" "postgresql.service"];
      wants = ["postgresql.service"];
      serviceConfig = {
        # Run under the sourcebot user
        Type = "oneshot";
        User = "sourcebot";
        Group = "sourcebot";
        ExecStart = "${pkgs.prisma}/bin/prisma migrate deploy --schema ${cfg.package}/packages/db/prisma/schema.prisma";
        Environment = [
          "PATH=${makeBinPath (with pkgs; [prisma openssl])}"
          "DATABASE_URL=${cfg.databaseUrl}"
        ];
        Restart = "on-failure";
        RestartSec = "5s";
      };
    };
    # Web frontend service
    systemd.services.sourcebot-web = {
      description = "SourceBot Web Service";
      after = ["network.target" "sourcebot-zoekt.service" "sourcebot-db-setup.service"];
      wants = ["sourcebot-zoekt.service" "sourcebot-db-setup.service"];
      wantedBy = ["multi-user.target"];
      serviceConfig = {
        # Run under the sourcebot user
        User = "sourcebot";
        Group = "sourcebot";
        Environment =
          [
            "DATA_DIR=${cfg.dataDir}"
            "DATA_CACHE_DIR=${cfg.dataCacheDir}"
            "PORT=${toString cfg.port}"
            "HOSTNAME=${cfg.hostname}"
            "DATABASE_URL=${cfg.databaseUrl}"
            "REDIS_URL=redis://localhost:${toString cfg.redisPort}"
            "CONFIG_PATH=${cfg.configPath}"
            "SOURCEBOT_LOG_LEVEL=${cfg.logLevel}"
            "SOURCEBOT_TENANCY_MODE=single"
            "AUTH_CREDENTIALS_LOGIN_ENABLED=${boolToString cfg.authEnabled}"
            "SOURCEBOT_TELEMETRY_DISABLED=${boolToString cfg.telemetryDisabled}"
            "SOURCEBOT_PUBLIC_KEY_PATH=${cfg.package}/public.pem"
            "AUTH_URL=http://${cfg.hostname}:${toString cfg.port}"
          ]
          ++ optional (cfg.envFile == null) [
            "AUTH_SECRET=00000000000000000000000000000000000000000000"
            "SOURCEBOT_ENCRYPTION_KEY=00000000000000000000000000000000"
          ];
        EnvironmentFile = cfg.envFile;
        ExecStart = "${cfg.package}/bin/sourcebot-web";
        Restart = "always";
      };
    };

    # Backend API service
    systemd.services.sourcebot-backend = {
      description = "SourceBot Backend Service";
      after = ["network.target" "sourcebot-zoekt.service" "sourcebot-db-setup.service"];
      wants = ["sourcebot-zoekt.service" "sourcebot-db-setup.service"];
      wantedBy = ["multi-user.target"];
      serviceConfig = {
        # Run under the sourcebot user
        User = "sourcebot";
        Group = "sourcebot";
        Environment =
          [
            "DATA_DIR=${cfg.dataDir}"
            "DATA_CACHE_DIR=${cfg.dataCacheDir}"
            "DATABASE_URL=postgresql://sourcebot@localhost:${toString config.services.postgresql.settings.port}/sourcebot"
            "REDIS_URL=redis://localhost:${toString cfg.redisPort}"
            "CONFIG_PATH=${cfg.configPath}"
            "SOURCEBOT_LOG_LEVEL=${cfg.logLevel}"
            "SOURCEBOT_TENANCY_MODE=single"
            "AUTH_CREDENTIALS_LOGIN_ENABLED=${boolToString cfg.authEnabled}"
            "SOURCEBOT_TELEMETRY_DISABLED=${boolToString cfg.telemetryDisabled}"
            "SOURCEBOT_PUBLIC_KEY_PATH=${cfg.package}/public.pem"
            "AUTH_URL=http://${cfg.hostname}:${toString cfg.port}"
          ]
          ++ optional (cfg.envFile == null) [
            "AUTH_SECRET=00000000000000000000000000000000000000000000"
            "SOURCEBOT_ENCRYPTION_KEY=00000000000000000000000000000000"
          ];
        EnvironmentFile = cfg.envFile;
        ExecStart = "${cfg.package}/bin/sourcebot-backend --cacheDir ${cfg.dataCacheDir}";
        Restart = "on-failure";
        RestartSec = "5s";
      };
    };
  };
}
