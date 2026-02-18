default:
  @just --list

test:
  npm run test

lint:
  npm run lint

build:
  npm run build

check:
  just lint test build

install-hooks:
  git config core.hooksPath .githooks
  chmod +x .githooks/pre-commit

dev:
  npm run dev

deploy:
  vercel deploy

ship-it:
  just check
  vercel deploy --prod
