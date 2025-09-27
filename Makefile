FRONTEND_DIR := frontend
BACKEND_DIR  := backend

PKG ?= npm

PYTHON ?= python3
VENV   := $(BACKEND_DIR)/venv
PYBIN  := $(VENV)/bin/python
PIPBIN := $(VENV)/bin/pip
MANAGE := $(PYBIN) $(BACKEND_DIR)/manage.py

NEXTJS_PORT ?= 8080
DJANGO_PORT ?= 8000

# --- Targets ---
.PHONY: help
help:
	@echo "make install          # install dev deps for both apps"
	@echo "make dev              # run both dev servers"
	@echo "make dev-frontend     # run Next.js dev server only"
	@echo "make dev-backend      # run Django dev server only"

.PHONY: install install-frontend install-backend
install: install-frontend install-backend

install-frontend:
	@cd $(FRONTEND_DIR) && \
	if [ "$(PKG)" = "npm" ]; then npm install; \
	elif [ "$(PKG)" = "yarn" ]; then yarn install; \
	elif [ "$(PKG)" = "pnpm" ]; then pnpm install; \
	else echo "Unsupported PKG=$(PKG)"; exit 1; fi

$(VENV):
	@cd $(BACKEND_DIR) && $(PYTHON) -m venv .venv

install-backend: $(VENV)
	@if [ -f "$(BACKEND_DIR)/requirements.txt" ]; then \
		$(PIPBIN) install -U pip && \
		$(PIPBIN) install -r $(BACKEND_DIR)/requirements.txt; \
	else \
		echo "No requirements.txt in $(BACKEND_DIR) — skipping."; \
	fi

.PHONY: dev dev-frontend dev-backend
dev:
	@echo "Starting Django :$(DJANGO_PORT) and Next.js :$(NEXTJS_PORT)"
	@set -m; \
	$(MAKE) dev-backend & BACK=$$!; \
	$(MAKE) dev-frontend & FRONT=$$!; \
	trap 'kill $$BACK $$FRONT 2>/dev/null || true' INT TERM; \
	wait

dev-frontend:
	@cd $(FRONTEND_DIR) && \
	if [ "$(PKG)" = "npm" ]; then npm run dev -- --port $(NEXTJS_PORT); \
	elif [ "$(PKG)" = "yarn" ]; then yarn dev -p $(NEXTJS_PORT); \
	elif [ "$(PKG)" = "pnpm" ]; then pnpm dev --port $(NEXTJS_PORT); \
	else echo "Unsupported PKG=$(PKG)"; exit 1; fi

dev-backend: $(VENV)
	@$(MANAGE) runserver 0.0.0.0:$(DJANGO_PORT)
