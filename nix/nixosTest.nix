{
  pkgs,
  self,
}:
pkgs.testers.nixosTest {
  name = "sourcebot-nixos-module-test";
  nodes.machine = {config, ...}: {
    virtualisation.graphics = false;
    documentation.enable = false;
    imports = [self.nixosModules.sourcebot];
    # disables  ForwardToConsole=yes:
    # https://github.com/NixOS/nixpkgs/blob/master/nixos/modules/testing/test-instrumentation.nix#L207
    services.journald.extraConfig = pkgs.lib.mkForce "";
    services.sourcebot = {
      enable = true;
      configPath = "${pkgs.writeText "config" ''
        {
        }
      ''}";
    };
  };
  testScript = ''
    start_all()
    machine.wait_for_unit("postgresql.service")
    machine.wait_for_unit("sourcebot-zoekt.service")
    machine.wait_for_unit("sourcebot-backend.service")
    machine.wait_for_unit("sourcebot-web.service")
    machine.wait_for_open_port(7734)
    machine.succeed("${pkgs.curl}/bin/curl http://localhost:7734")
  '';
}
