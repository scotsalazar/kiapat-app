.PHONY: dev seed test build-zip

# Use uvicorn for development
dev:
	uvicorn app.main:app --reload --port $${PORT:-8000}

# Seed the database by calling the seed endpoint
seed:
	curl -X POST http://localhost:$${PORT:-8000}/api/admin/seed -H "seed-token: $${SEED_TOKEN:-seed-secret}"

# Run pytest
test:
	pytest -q

# Build zip archive for deployment
build-zip:
	cd .. && zip -r kiapat-inventory-mvp.zip server web README.md -x "*/__pycache__/*"