default:
  @just --list

test:
  npm run test

build:
  npm run build

dev:
  npm run dev

deploy:
  vercel deploy
