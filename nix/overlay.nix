final: prev: {
  sourcebot = final.callPackage ./sourcebot.nix {};
  zoekt = prev.zoekt.overrideAttrs (old: rec {
    vendorHash = "sha256-laiBp+nMWEGofu7zOgfM2b8MIC+Dfw7eCLgb/5zf9oo=";
    src = final.fetchFromGitHub {
      owner = "sourcegraph";
      repo = "zoekt";
      rev = "12a2f4ad075359a09bd8a91793acb002211217aa";
      hash = "sha256-JByTgJsnqLlP7hNbQumM4zqZZuj7igc2V35vw0ahCqM=";
    };
  });
}
