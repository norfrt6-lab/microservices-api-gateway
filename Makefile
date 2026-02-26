SHELL := /bin/sh

.PHONY: test-integration test-integration-up test-integration-down

# Build + start stack, run integration tests, then shut down
test-integration:
	docker compose build
	docker compose up -d
	./scripts/integration-test.sh http://localhost:3000
	docker compose down -v

# Helpers if you want to control lifecycle manually
test-integration-up:
	docker compose build
	docker compose up -d

test-integration-down:
	docker compose down -v
