# Contributing

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/claude-code-bestpractices/` in your browser.

## Project Structure

- `index.html` — Main presentation (12-chapter slideshow)
- `src/` — TypeScript + CSS (Vite-bundled)
- `public/lessons/` — Static lesson pages + manifest
- `research/` — Source material for AI-generated lessons
- `.github/workflows/` — CI/CD and lesson automation

## Lessons Are Auto-Generated

Lessons are created automatically by a GitHub Actions workflow (`claude-lessons.yml`) that runs Mon/Wed/Fri. **Do not manually create or edit lesson HTML files** — they will be overwritten.

To influence future lesson topics, add research material to the `research/` directory:

1. Create a new markdown file in `research/` (e.g., `11-new-topic.md`)
2. Include factual, well-structured content about Claude Code features or practices
3. The lesson generator reads all research files and picks uncovered topics

## Pull Requests

- All changes go through PRs — direct pushes to `master` are blocked
- PR preview deploys are automatic via GitHub Pages
- The `build-and-deploy` check must pass before merging
- Keep PRs focused — one concern per PR

## Self-Hosted Runner

The lesson generation workflow requires a self-hosted runner with Claude CLI installed. This is needed because Claude Code is not available as a standard GitHub Action.
