{
  pkgs,
  lib,
  ...
}: {
  microvm = {
    mem = 1024;

    interfaces = [
      {
        type = "user";
        id = "sourcebot";
        mac = "02:00:00:00:00:10";
      }
    ];
    forwardPorts = [
      {
        from = "host";
        host.port = 47734;
        guest.port = 7734;
      }
    ];

    shares = [
      {
        tag = "ro-store";
        source = "${builtins.storeDir}";
        mountPoint = "/nix/.ro-store";
      }
    ];
    volumes = [
      {
        mountPoint = "/var";
        image = "sourcebot-var.img";
        size = 1 * 1024; # 1GB
      }
    ];
  };

  system.stateVersion = lib.trivial.release;

  users.users.root.password = "";

  # Enable autologin for root user
  services.getty.autologinUser = "root";

  services.sourcebot = {
    enable = true;
    logLevel = "debug";
    configPath = "${pkgs.writeText "config" (builtins.toJSON {
      "$schema" = "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json";
      connections = {
        starter-connection = {
          type = "github";
          repos = [
            "sourcebot-dev/sourcebot"
          ];
        };
      };
    })}";
  };

  networking.firewall.enable = false;
}
