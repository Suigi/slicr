{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.just
    pkgs.nodejs_24
    pkgs.nodePackages.vercel
  ];
}

