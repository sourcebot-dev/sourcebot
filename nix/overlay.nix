final: prev: {
  sourcebot = final.callPackage ./sourcebot.nix {};
  zoekt = prev.zoekt.overrideAttrs (old: rec {
    vendorHash = "sha256-laiBp+nMWEGofu7zOgfM2b8MIC+Dfw7eCLgb/5zf9oo=";
    src = final.fetchFromGitHub {
      owner = "sourcegraph";
      repo = "zoekt";
      rev = "07c64afd5c719b5c95aae21c71009aacadbc528e";
      hash = "sha256-y9HwzPdNfqw9JM8XaZ4RxyN4cAYQhiqKKqP2c4wvSH0=";
    };
  });
}
