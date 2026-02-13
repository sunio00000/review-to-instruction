# Review to Instruction

[![AI Generated](https://img.shields.io/badge/🤖_AI_Generated-Claude_Sonnet_4.5-8A2BE2.svg)](https://www.anthropic.com/claude)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)



https://github.com/user-attachments/assets/a78b3033-9021-4fa2-8a7e-e2c038182d31



> Transform PR review comments into structured AI instructions with a single click

A Chrome extension that converts GitHub/GitLab review comments into instruction files for **Claude Code**, **Cursor**, **Windsurf**, and **Codex**. Click a button on any convention-related comment, and the extension generates properly formatted instruction files, commits them, and creates a PR — keeping your AI agents aligned with your team's standards.

## How It Works

> **Your team's code review comments are goldmines of coding standards.**
> But they get buried in closed PRs, never to be seen again.
>
> This extension captures them — instantly turning tribal knowledge into AI-readable rules.

```diff
  💬 PR Review Comment
  ─────────────────────────────────────────
  "Our team uses PascalCase for component file names.
   ✅ UserProfile.tsx
   ❌ userProfile.tsx"

                    ⚡ One Click

  📁 Auto-generated files:
+ .claude/rules/component-naming.md
+ .cursor/rules/component-naming.md
+ .windsurf/rules/component-naming.md
+ AGENTS.md  (Codex — appended)

  🔀 → New PR created, ready to merge
```

Every AI agent on your team now follows the same conventions. No copy-paste. No forgotten rules.

## 3-Level Conversion

| Level | Scope | Trigger |
|-------|-------|---------|
| **Level 1** | Single comment | "Convert to AI Instruction" button on individual comments |
| **Level 2** | Discussion thread | "Convert Thread (N comments)" button on threads with 2+ comments |
| **Level 3** | Entire PR/MR | "Wrapup" button — collects all convention comments across the PR |

Each level analyzes comments at a different granularity, filtering out non-convention content (thanks, LGTM, etc.) and merging related instructions.

## Installation

1. **Build the extension:**
   ```bash
   git clone https://github.com/sunio00000/review-to-instruction.git
   cd review-to-instruction
   npm install
   npm run build
   ```

2. **Load in Chrome:**
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

3. **Configure API access:**
   - Click the extension icon in your browser
   - Set a master password (encrypts all stored tokens)
   - Enter your GitHub/GitLab API token (`repo` scope for GitHub, `api` scope for GitLab)
   - Optionally enter a Claude or OpenAI API key for LLM-enhanced analysis
   - Test the connection and save

4. **Start using:**
   - Navigate to any PR on GitHub or MR on GitLab
   - Use Level 1/2/3 buttons depending on scope
   - Review the preview modal, edit if needed, then confirm
   - Merge the generated PR

## Features

### Multi-Platform Support
- **GitHub** (github.com)
- **GitLab** (gitlab.com + self-hosted instances)

### Multi-AI-Tool Output
Generates instruction files for all detected project types simultaneously:

| AI Tool | Output Path | Format |
|---------|-------------|--------|
| Claude Code | `.claude/rules/<name>.md` | Markdown with frontmatter |
| Cursor | `.cursor/rules/<name>.md` | Markdown |
| Windsurf | `.windsurf/rules/<name>.md` | Markdown |
| Codex | `AGENTS.md` (root) | Single file, append-based |

### Intelligent Processing
- **Convention Filtering**: Automatically distinguishes convention comments from casual ones (supports English and Korean keywords)
- **LLM Enhancement** (Optional): Uses Claude or OpenAI to improve summaries, classify categories, and generate detailed explanations
- **Code Context Extraction**: Captures `diff_hunk` from inline review comments via API for richer context
- **Smart File Matching**: Detects existing instruction files and updates or merges instead of duplicating
- **Smart File Naming**: Generates filenames matching your project's naming convention (kebab-case, PascalCase, snake_case)
- **Preview Modal**: Review and edit generated instructions before committing
- **Caching**: Reduces LLM API costs by 50-70% through intelligent result caching
- **Token Tracking**: Displays real-time API token usage and cost estimates

### Security
- **AES-GCM 256-bit encryption** for all stored API tokens
- **PBKDF2 key derivation** (500K iterations) from master password
- **Web Crypto API** — browser-native cryptography, no external dependencies

## Architecture

```
  +----------------------------------------------+
  |          Chrome Extension (MV3)              |
  +----------------------------------------------+

  +- Content Script (PR pages) -----------------+
  |                                              |
  |  GitHub/GitLab Injectors                     |
  |  CommentDetector  *  ThreadDetector          |
  |  UIBuilder  *  WrapupButtonManager           |
  |  PreviewModal                                |
  |                                              |
  +---------------------+------------------------+
                        |
                chrome.runtime
                  .sendMessage
                        |
  +---------------------v------------------------+
  |                                              |
  |  Background Service Worker                   |
  |                                              |
  |  MessageHandler                              |
  |    -> ConversionOrchestrator                 |
  |         |-- CommentService --> LLM Clients   |
  |         |                     (Claude/OpenAI)|
  |         |-- FileGenerationService            |
  |         |     +-- GeneratorFactory           |
  |         |         Claude Code | Cursor       |
  |         |         Windsurf   | Codex         |
  |         +-- PRService                        |
  |                                              |
  |  ConfigService * CryptoService               |
  |  SessionManager                              |
  |                                              |
  +------------+-------------------+-------------+
               |                   |
               v                   v
       GitHub/GitLab API    Claude/OpenAI API

  +- Popup (Settings UI) -----------------------+
  |                                              |
  |  Master Password  *  API Tokens              |
  |  LLM Provider  *  Cache Stats & Token Usage  |
  |                                              |
  +----------------------------------------------+
```

### Data Flow

```
  Click --> Collect --> Background --> Fetch Metadata
  Button    Comment     Message       & Replies
                                         |
  Success <-- Create <-- Dedupe <-- LLM Analysis
  Notice      PR         & Merge    (optional)
                                         |
                                    Generate Files
                                    (per AI tool)
```

## Tech Stack

| Category | Technology |
|----------|-----------|
| Language | TypeScript (strict mode) |
| Build | Vite 7 + @crxjs/vite-plugin |
| Extension | Chrome Manifest V3 |
| Unit/Integration Tests | Vitest + happy-dom |
| E2E Tests | Playwright |
| API Mocking | MSW (Mock Service Worker) |
| Encryption | Web Crypto API (AES-GCM, PBKDF2) |
| LLM | Claude API (Sonnet 4.5), OpenAI API (GPT-4) |

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build

# Run unit/integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Test coverage report
npm run test:coverage

# Vitest UI
npm run test:ui

# E2E tests (requires build first)
npx playwright test
```

## License

MIT License — See [LICENSE](./LICENSE) for details.

---

Made with Claude Sonnet 4.5 | [Report Issues](https://github.com/sunio00000/review-to-instruction/issues)
