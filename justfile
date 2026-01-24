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

# Run tests once
js-test:
    npx vitest -r cast_vue/static/src/tests/

# Run tests in watch mode
js-test-watch:
    npx vitest watch

# Run tests with coverage
js-coverage:
    npx vitest run --coverage

# Preview built bundle
js-preview:
    npx vite preview
