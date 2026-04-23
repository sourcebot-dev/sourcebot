{
  pkgs,
  lib,
}:
pkgs.stdenv.mkDerivation (finalAttrs: {
  name = "sourcebot";

  # Use fileset API for cleaner source filtering
  # Only include git-tracked files, excluding development/build/docs files
  src = lib.fileset.toSource {
    root = ../.;
    fileset =
      lib.fileset.difference
      (lib.fileset.gitTracked ./..)
      (lib.fileset.unions [
        ../nix/microvm.nix
        ../nix/nixosModule.nix
        ../nix/nixosTest.nix
        ../nix/overlay.nix
        ../nix/missing-hashes.json
        ../flake.nix
        ../flake.lock
        ../.github
        ../docs
        ../README.md
        ../CONTRIBUTING.md
        ../CHANGELOG.md
        ../LICENSE.md
        ../.gitignore
        ../docker-compose-dev.yml
        ../Dockerfile
        ../grafana.alloy
        ../supervisord.conf
        ../fly.toml
        ../Makefile
        ../_typos.toml
      ]);
  };

  buildInputs = with pkgs; [
    nodejs
    yarn
    redis
    openssl
  ];
  buildPhase = ''
    runHook preBuild
    ${lib.getExe pkgs.yarn-berry} workspaces foreach -R --from '{@sourcebot/schemas,@sourcebot/error,@sourcebot/db}' run build
    ${lib.getExe pkgs.yarn-berry} build:deps
    ${lib.getExe pkgs.yarn-berry} build
    runHook postBuild
  '';
  missingHashes = ./missing-hashes.json;
  offlineCache = pkgs.yarn-berry.fetchYarnBerryDeps {
    inherit (finalAttrs) src missingHashes;
    hash = "sha256-FpSmCMvHRDea+UOdVIp/c0ydF2zSWjbcU056oBrP0/Y=";
  };

  nativeBuildInputs = with pkgs; [
    yarn-berry.yarnBerryConfigHook
    yarn-berry
    nodejs
    nodePackages.prisma
    makeWrapper
  ];

  env = {
    YARN_ENABLE_SCRIPTS = "false";
    PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/schema-engine";
    PRISMA_QUERY_ENGINE_BINARY = "${pkgs.prisma-engines}/bin/query-engine";
    PRISMA_QUERY_ENGINE_LIBRARY = "${pkgs.prisma-engines}/lib/libquery_engine.node";
    PRISMA_FMT_BINARY = "${pkgs.prisma-engines}/bin/prisma-fmt";
  };

  installPhase = ''
    runHook preInstall


    cp -r packages/web/.next/standalone $out
    cp -r node_modules/* $out/node_modules

    mkdir -p $out/packages/web
    cp -r packages/web/public $out/packages/web/public
    mkdir -p $out/packages/web/.next
    cp -r packages/web/.next/static $out/packages/web/.next/static

    mkdir -p $out/packages/backend
    cp -r packages/backend/node_modules/* $out/node_modules
    cp -r packages/backend/* $out/packages/backend

    cp -r packages/db/* $out/packages/db
    cp -r packages/schemas/* $out/packages/schemas
    # cp -r packages/crypto/* $out/packages/crypto
    # cp -r packages/error $out/packages/error
    cp -r packages/mcp $out/packages/mcp
    # cp -r packages/logger/* $out/packages/logger
    cp -r packages/shared/* $out/packages/shared
    cp -r node_modules/* $out/node_modules
    mkdir -p $out/vendor
    cp -r ${pkgs.zoekt.src}/ $out/vendor/zoekt

    mkdir -p $out/bin
    cp public.pem $out/

    rm -rf $out/pacakages/web/.next/cache
    ln -s /var/cache/sourcebot $out/packages/web/.next/cache

    # web
    cat <<EOF > $out/bin/sourcebot-web
    #!${pkgs.runtimeShell}
    export PATH=\$PATH:${pkgs.openssl}/bin
    export NODE_ENV=production
    export NODE_PATH=$out/node_modules
    export PRISMA_SCHEMA_ENGINE_BINARY=${pkgs.prisma-engines}/bin/schema-engine
    export PRISMA_QUERY_ENGINE_BINARY=${pkgs.prisma-engines}/bin/query-engine
    export PRISMA_QUERY_ENGINE_LIBRARY=${pkgs.prisma-engines}/lib/libquery_engine.node
    export PRISMA_FMT_BINARY=${pkgs.prisma-engines}/bin/prisma-fmt

    exec ${pkgs.nodejs}/bin/node $out/packages/web/server.js "\$@"
    EOF

    # backend
    cat <<EOF > $out/bin/sourcebot-backend
    #!${pkgs.runtimeShell}
    export NODE_ENV=production
    export NODE_PATH=$out/node_modules
    export PRISMA_SCHEMA_ENGINE_BINARY=${pkgs.prisma-engines}/bin/schema-engine
    export PRISMA_QUERY_ENGINE_BINARY=${pkgs.prisma-engines}/bin/query-engine
    export PRISMA_QUERY_ENGINE_LIBRARY=${pkgs.prisma-engines}/lib/libquery_engine.node
    export PRISMA_FMT_BINARY=${pkgs.prisma-engines}/bin/prisma-fmt

    export PATH=${pkgs.lib.makeBinPath (with pkgs; [prisma openssl git zoekt])}
    exec ${pkgs.nodejs}/bin/node $out/packages/backend/dist/index.js "\$@"
    EOF

    # mcp
    cat <<EOF > $out/bin/sourcebot-mcp
    #!${pkgs.runtimeShell}
    export NODE_ENV=production
    export NODE_PATH=$out/node_modules
    exec ${pkgs.nodejs}/bin/node $out/packages/mcp/dist/index.js "\$@"
    EOF
    chmod +x $out/bin/*


    runHook postInstall
  '';
})
