SHELL := /bin/bash
.PHONY: bootstrap doctor test test-python test-runtime test-drive test-gateway test-cloudflare test-temporal test-p0 test-codex-live

bootstrap:
	python3 -m pip install -q pytest jsonschema
	cd workflows/temporal && npm install --no-audit --no-fund
	@if [ -f deploy/vercel-chatgpt-app/package.json ]; then cd deploy/vercel-chatgpt-app && npm install --no-audit --no-fund; fi
	@if [ -f deploy/cloudflare-kernel/package.json ]; then cd deploy/cloudflare-kernel && npm install --no-audit --no-fund; fi

doctor:
	python3 scripts/doctor.py

test-python:
	python3 -m pytest -q tests

test-runtime:
	python3 -m pytest -q packages/runtime/test

test-drive:
	python3 -m pytest -q adapters/drive/test

test-gateway:
	@if [ -f deploy/vercel-chatgpt-app/package.json ]; then cd deploy/vercel-chatgpt-app && npm test; else echo 'gateway absent: skipped'; fi

test-cloudflare:
	@if [ -f deploy/cloudflare-kernel/package.json ]; then cd deploy/cloudflare-kernel && npm test; else echo 'cloudflare experiment absent: skipped'; fi

test-temporal:
	cd workflows/temporal && npm run check && npm test

test: doctor test-python test-runtime test-drive test-gateway test-cloudflare test-temporal

test-p0: test
	python3 scripts/validate_p0_evidence.py

test-codex-live:
	AKASHIC_LIVE_CODEX=1 python3 scripts/codex_live_two_turn.py --evidence-dir .akashic-evidence/codex-live
