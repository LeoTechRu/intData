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
	mypy core web

audit:
	- pip-audit || true
	- bandit -q -r core web || true

smoke:
	python -m core.db.migrate
	python -m core.db.repair
