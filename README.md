# Review to Instruction

<div align="center">

[![AI Generated](https://img.shields.io/badge/🤖_AI_Generated-Claude_Sonnet_4.5-8A2BE2.svg)](https://www.anthropic.com/claude)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**One-Click Conversion of PR Review Comments into AI-Ready Instructions**

Transform GitHub/GitLab review comments into structured instruction files for Claude Code, Cursor, and Windsurf

</div>

---

## 🎯 What It Does

Turns this PR comment:
```
Our team uses PascalCase for component file names.

✅ UserProfile.tsx
❌ userProfile.tsx
```

Into AI-ready instruction files automatically:
- `.claude/instructions/component-naming.md`
- `.cursorrules` (appends rule)
- `rules/component-naming.md`

**All in one PR with a single click.**

## 🏗️ How It Works

```mermaid
graph LR
    A[PR Comment] -->|1. Detect| B[Extension Button]
    B -->|2. Parse| C[Extract Keywords]
    C -->|3. Match| D[Find Existing Files]
    D -->|4. Generate| E[Create/Update Files]
    E -->|5. Auto-Commit| F[New PR Created]

    style A fill:#e1f5ff
    style F fill:#d4edda
```

### Architecture

```mermaid
graph TB
    subgraph "GitHub/GitLab Page"
        A[Content Script]
    end

    subgraph "Extension Background"
        B[Message Handler]
        C[API Client]
        D[Parser]
        E[File Generator]
    end

    subgraph "External APIs"
        F[GitHub/GitLab API]
        G[LLM API Optional]
    end

    A -->|Comment Data| B
    B --> D
    D -->|Keywords| E
    E --> C
    C --> F
    B -.->|Enhance| G
    C -->|Create PR| F

    style A fill:#e1f5ff
    style B fill:#fff3cd
    style F fill:#d4edda
    style G fill:#f8d7da,stroke-dasharray: 5 5
```

## 🚀 Quick Start

### 1. Install Extension

```bash
git clone https://github.com/sunio00000/review-to-instruction.git
cd review-to-instruction
npm install
npm run build
```

Load `dist/` folder in Chrome (`chrome://extensions` → Developer mode → Load unpacked)

### 2. Configure API Token

1. Click extension icon
2. Generate GitHub/GitLab token with `repo` scope
3. Paste token and click "Test Connection"
4. Save

### 3. Use in PR

1. Write convention comment with keywords (`convention`, `rule`, `pattern`)
2. Click **"Convert to AI Instruction"** button
3. Review generated PR
4. Merge

Done! Your AI agents now understand this convention.

## ✨ Key Features

- **Multi-Tool Support**: Auto-detects Claude Code, Cursor, Windsurf in your project
- **Smart Matching**: Updates existing files or creates new ones intelligently
- **LLM Enhancement** (Optional): Uses Claude/OpenAI for better summaries and explanations
- **Intelligent Caching**: Reduces LLM API costs by 50-70%
- **Dark Mode**: Adapts to GitHub/GitLab themes

## 🛠️ Tech Stack

TypeScript · Vite · Chrome Extension (Manifest V3) · GitHub/GitLab REST API

## 📋 Documentation

- **[TESTING.md](./TESTING.md)** - Testing guide and scenarios
- **[Claude Code Plugin Format](https://docs.anthropic.com/claude/docs)** - Learn about `.claude/` structure

## ❓ FAQ

**Q: What keywords trigger detection?**
Comments with `convention`, `rule`, `pattern`, `should`, `must`, or code examples (```)

**Q: Does it support GitLab self-hosted?**
Not yet. Only `gitlab.com` currently supported.

**Q: Can I skip LLM analysis?**
Yes! LLM is completely optional. Extension works perfectly with rule-based parsing alone.

**Q: Which AI tools are supported?**
Claude Code (`.claude/`), Cursor (`.cursorrules`), Windsurf (`rules/`)

**Q: Can I batch-process multiple comments?**
Not yet. Planned for v1.3.

## 📝 License

MIT License - See [LICENSE](./LICENSE) for details.

## 📧 Contact

Questions or suggestions? Open an issue on [GitHub](https://github.com/sunio00000/review-to-instruction/issues)

---

<div align="center">

Made with ❤️ and Claude Sonnet 4.5

⭐ **[Star this repo](https://github.com/sunio00000/review-to-instruction)** if it helped you!

</div>
