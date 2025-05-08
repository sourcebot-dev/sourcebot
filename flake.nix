{
  description = "SourceBot - Code search and navigation tool";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    microvm.url = "github:astro/microvm.nix";
    microvm.inputs.nixpkgs.follows = "nixpkgs";
  };
  outputs = {
    self,
    nixpkgs,
    flake-utils,
    microvm,
  }:
    flake-utils.lib.eachSystemPassThrough ["x86_64-linux"] (system: {
      nixosModules = rec {
        default = sourcebot;
        sourcebot = import ./nix/nixosModule.nix self;
      };

      nixosConfigurations.testing = nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [
          self.nixosModules.sourcebot
        ];
      };

      overlays.default = import ./nix/overlay.nix;
    })
    // flake-utils.lib.eachSystem ["x86_64-linux"] (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [self.overlays.default];
        };
        sourcebotSystem = nixpkgs.lib.nixosSystem {
          inherit system pkgs;
          modules = [
            microvm.nixosModules.microvm
            self.nixosModules.sourcebot
            ./nix/microvm.nix
          ];
        };
      in {
        packages = rec {
          default = sourcebot;
          sourcebot = pkgs.callPackage ./nix/sourcebot.nix {};
          microvm = sourcebotSystem.config.microvm.declaredRunner;
        };

        checks.default = pkgs.callPackage ./nix/nixosTest.nix {inherit self;};

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            yarn-berry
            yarn-berry.yarn-berry-fetcher
            openssl
            yarn
            redis
          ];
          buildInputs = with pkgs; [
            nodePackages.prisma
          ];
          YARN_ENABLE_SCRIPTS = "false";
          PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";
          PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
          PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
          PRISMA_FMT_BINARY = "${pkgs.prisma-engines}/bin/prisma-fmt";
        };
      }
    );
}
