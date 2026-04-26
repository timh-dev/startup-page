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
	@echo "  css            - Build Tailwind CSS"

# Install frontend dependencies
install:
	@echo "Installing frontend dependencies..."
	npm install

# Install server dependencies
server-install:
	@echo "Installing server dependencies..."
	cd server && npm install

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
	@$(MAKE) css
	@$(MAKE) build

# Start development server
start:
	@echo "Starting development server..."
	npm run start

# Alias for start
dev: start

# Start backend server
server-start:
	@echo "Starting backend server..."
	cd server && node index.js

# Build Tailwind CSS
css:
	@echo "Building Tailwind CSS..."
	npm run build:tailwind

# Build for production
build: css
	@echo "Building for production..."
	npm run build

# Build for local deployment
build-local: css
	@echo "Building for local deployment..."
	npm run build:local

# Build for Vercel deployment
build-vercel: css
	@echo "Building for Vercel deployment..."
	npm run build:vercel

# Preview production build
preview:
	@echo "Starting preview server..."
	npm run preview

# Build and serve locally
serve: build-local
	@echo "Building and serving locally on port 8000..."
	npm run serve

# Deploy to GitHub Pages
deploy:
	@echo "Deploying to GitHub Pages..."
	npm run deploy

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf node_modules/.vite/
	@echo "Clean complete."

# Development workflow shortcuts
quick-start: install css start
full-setup: setup start