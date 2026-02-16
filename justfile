default:
  @just --list

test:
  npm run test

lint:
  npm run lint

build:
  npm run build

dev:
  npm run dev

deploy:
  vercel deploy
