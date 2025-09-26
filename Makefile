.PHONY: setup-dev lint fmt typecheck audit smoke

setup-dev:
	pip install -r requirements-dev.txt
	pre-commit install

lint:
	ruff check .

fmt:
	ruff format .
	isort .

typecheck:
	mypy backend web

audit:
	- pip-audit || true
	- bandit -q -r backend web || true

smoke:
	python -m backend.db.migrate
	python -m backend.db.repair
