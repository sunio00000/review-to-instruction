# Review to Instruction

[![AI Generated](https://img.shields.io/badge/🤖_AI_Generated-Claude_Sonnet_4.5-8A2BE2.svg)](https://www.anthropic.com/claude)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> Transform PR review comments into structured AI instructions with a single click

A Chrome extension that automatically converts GitHub/GitLab review comments into instruction files for Claude Code, Cursor, and Windsurf. Simply click a button on any convention-related comment, and the extension generates properly formatted instructions, creates a PR, and keeps your AI agents aligned with your team's standards.

## Overview

When reviewing code, teams often establish conventions through PR comments. This extension automates the tedious process of documenting those conventions into AI-readable instruction files.

**Example:**

A PR comment like this:
```
Our team uses PascalCase for component file names.

✅ UserProfile.tsx
❌ userProfile.tsx
```

Becomes these files automatically:
- `.claude/rules/component-naming.md`
- `.cursorrules`
- `.windsurf/rules/component-naming.md`

All committed to a new PR with proper formatting and metadata.

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
   - Enter your GitHub/GitLab API token (requires `repo` scope)
   - Test the connection and save

4. **Start using:**
   - Navigate to any PR/MR on GitHub or GitLab
   - Find a comment containing conventions (keywords like `convention`, `rule`, `pattern`)
   - Click the "Convert to AI Instruction" button
   - Review and merge the generated PR

## Features

### Multi-Platform Support
Automatically detects and generates instruction files for:
- **Claude Code** (`.claude/rules/`, `.claude/skills/`)
- **Cursor** (`.cursorrules`)
- **Windsurf** (`.windsurf/rules/`)

### Intelligent Processing
- **Smart File Matching**: Automatically updates existing files or creates new ones based on similarity scoring
- **Thread Analysis**: Analyzes entire comment threads including all replies for comprehensive context
- **AI Enhancement** (Optional): Uses Claude or OpenAI APIs to improve summaries and generate better explanations
- **Caching**: Reduces LLM API costs by 50-70% through intelligent result caching
- **Token Tracking**: Displays API token usage for transparency

### Project-Aware
- **Convention Detection**: Learns your project's existing file naming patterns (kebab-case, PascalCase, snake_case)
- **Smart Naming**: Generates appropriate filenames that match your project's style
- **Duplicate Prevention**: Detects similar existing instructions to avoid file proliferation

## Technical Details

**Built with:**
- TypeScript, Vite, Chrome Extension API (Manifest V3)
- GitHub/GitLab REST APIs
- Claude API & OpenAI API (optional)
- Playwright for E2E testing
- Service layer architecture with dependency injection

**Supported Platforms:**
- GitHub (github.com)
- GitLab (gitlab.com)

## License

MIT License - See [LICENSE](./LICENSE) for details.

---

Made with Claude Sonnet 4.5 | [Report Issues](https://github.com/sunio00000/review-to-instruction/issues)
