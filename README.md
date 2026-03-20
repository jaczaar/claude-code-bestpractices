# Claude Code — Best Practices

An interactive educational site covering Claude Code from setup to multi-agent workflows. 12-chapter slideshow + automated flashcard lessons.

**[View the live site](https://jaczaar.github.io/claude-code-bestpractices/)**

---

## Interactive Presentation

A keyboard-navigable, touch-friendly slideshow covering 12 topics:

CLAUDE.md &rarr; Context Management &rarr; Memory &rarr; The Toolbox &rarr; Slash Commands &rarr; Skills &rarr; MCP Servers &rarr; Autonomous Loops &rarr; Multi-Agent &rarr; GSD Framework &rarr; Desktop App

Features: sidebar TOC, progress bar, swipe gestures, modal deep-dives, responsive design.

## Automated Lessons

AI-generated flashcard-style lessons published Mon/Wed/Fri via GitHub Actions:

```
┌─────────┐     ┌───────────┐     ┌──────────────┐     ┌─────────┐     ┌───────────┐
│  Cron    │────▶│ Claude CLI│────▶│ Generate HTML │────▶│ Open PR │────▶│Send Email │
│ MWF 7am │     │reads      │     │ + update JSON │     │ + preview│     │notification│
│          │     │research/  │     │              │     │  deploy  │     │            │
└─────────┘     └───────────┘     └──────────────┘     └─────────┘     └───────────┘
```

Each lesson includes a flashcard quiz, structured content, and a key takeaway. Browse them at [/lessons](https://jaczaar.github.io/claude-code-bestpractices/lessons/).

## Quick Start

```bash
npm install
npm run dev
```

## Project Structure

```
├── index.html              # Main presentation
├── src/
│   ├── main.ts             # Entry point
│   ├── toc-controller.ts   # Slide navigation + modal logic
│   └── styles/             # CSS (global, layout, components, animations)
├── public/
│   └── lessons/            # Static lesson pages + manifest
├── research/               # Source material for lesson generation
└── .github/workflows/
    ├── deploy.yml          # GitHub Pages deployment
    ├── claude-lessons.yml  # Automated lesson generation
    └── pr-preview.yml      # PR preview deploys
```

## Tech Stack

Vite &middot; TypeScript &middot; GitHub Pages &middot; GitHub Actions &middot; Claude CLI

## License

[ISC](LICENSE)
