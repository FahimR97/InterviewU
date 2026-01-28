.PHONY: format lint test build

format:
	black src/

lint:
	flake8 src/

test:
	pytest

build: format lint test
	@echo "✅ Build complete: formatted, linted, and tested"
