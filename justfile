# Justfile for cast-vue development

default:
    @just --list

# Install JavaScript dependencies
js-install:
    npm install

# Run Vite development server
js-dev:
    npx vite

# Build Vite bundle
js-build:
    npx vite build

# Build and normalize bundle outputs
js-build-sync:
    just js-build
    sh -c 'test -f cast_vue/static/cast_vue/.vite/manifest.json && mv cast_vue/static/cast_vue/.vite/manifest.json cast_vue/static/cast_vue/manifest.json || true'
    python -c "from pathlib import Path; p=Path('cast_vue/static/cast_vue/manifest.json'); txt=p.read_text() if p.exists() else None; (p.write_text(txt.rstrip('\\n')+'\\n') if txt is not None else None)"
    rm -rf cast_vue/static/cast_vue/.vite

# Run tests once
js-test:
    npx vitest run -r cast_vue/static/src/tests/

# Run tests in watch mode
js-test-watch:
    npx vitest watch

# Run tests with coverage
js-coverage:
    npx vitest run --coverage

# Preview built bundle
js-preview:
    npx vite preview
