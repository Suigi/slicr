# Show available recipes when running `just` without arguments.
default:
  @just --list

# Configure and enable local git hooks for this repository.
[group('Setup')]
install-hooks:
  git config core.hooksPath .githooks
  chmod +x .githooks/pre-commit

# Run the project test suite.
[group('Quality')]
test:
  npm run test

# Run static lint checks.
[group('Quality')]
lint:
  npm run lint

# Build the production bundle.
[group('Quality')]
build:
  npm run build

# Run lint, tests, and build as a full local verification pass.
[group('Quality')]
check:
  just lint test build

# Start the local development server.
[group('Development')]
dev:
  npm run dev

# Create a preview deployment on Vercel.
[group('Deployment')]
preview:
  vercel deploy

# Run checks and then deploy to production.
[group('Deployment')]
ship-it:
  just check
  vercel deploy --prod
