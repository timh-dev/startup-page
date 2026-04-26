# Start Page Makefile
# Simplifies common development tasks

.PHONY: help install setup start build build-local build-vercel preview serve deploy clean dev server-install server-start all-install

# Default target
help:
	@echo "Available targets:"
	@echo "  help           - Show this help message"
	@echo "  install        - Install frontend dependencies"
	@echo "  server-install - Install server dependencies"
	@echo "  all-install    - Install both frontend and server dependencies"
	@echo "  setup          - Run initial project setup (copies config, installs deps, builds)"
	@echo "  start          - Start development server (opens browser)"
	@echo "  dev            - Alias for start"
	@echo "  server-start   - Start the backend server"
	@echo "  build          - Build for production"
	@echo "  build-local    - Build for local deployment"
	@echo "  build-vercel   - Build for Vercel deployment"
	@echo "  preview        - Preview production build"
	@echo "  serve          - Build and serve locally on port 8000"
	@echo "  deploy         - Deploy to GitHub Pages"
	@echo "  clean          - Clean build artifacts"
	@echo "  css            - No-op; Vite builds CSS automatically"

# Install frontend dependencies
install:
	@echo "Installing frontend dependencies..."
	pnpm install

# Install server dependencies
server-install:
	@echo "Installing server dependencies..."
	pnpm install --filter server

# Install all dependencies
all-install: install server-install

# Initial project setup
setup:
	@echo "Running project setup..."
	@echo "Copying config file..."
	@if [ ! -f "src/config/index.js" ]; then \
		cp src/config/index.example.js src/config/index.js 2>/dev/null || echo "Config example not found, skipping..."; \
	else \
		echo "Config file already exists."; \
	fi
	@$(MAKE) install
	@$(MAKE) build

# Start development server
start:
	@echo "Starting development server..."
	pnpm run dev

# Alias for start
dev: start

# Start backend server
server-start:
	@echo "Starting backend server..."
	pnpm --dir server exec node index.js

# Build Tailwind CSS
css:
	@echo "CSS is built by Vite during dev/build; no standalone step is required."

# Build for production
build:
	@echo "Building for production..."
	pnpm run build

# Build for local deployment
build-local:
	@echo "Building for local deployment..."
	pnpm run build:local

# Build for Vercel deployment
build-vercel:
	@echo "Building for Vercel deployment..."
	pnpm run build:vercel

# Preview production build
preview:
	@echo "Starting preview server..."
	pnpm run preview

# Build and serve locally
serve: build-local
	@echo "Building and serving locally on port 8000..."
	pnpm run serve

# Deploy to GitHub Pages
deploy:
	@echo "Deploying to GitHub Pages..."
	pnpm run deploy

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf node_modules/.vite/
	@echo "Clean complete."

# Development workflow shortcuts
quick-start: install css start
full-setup: setup start
