# Release v1.0.0

**Release Date:** 2026-01-29

## What Does It Do?

Automatically converts GitHub/GitLab PR review comments into AI instruction files for Claude Code, Cursor, and Windsurf with a single click.

## Supported Platforms

### Git Platforms
- **GitHub** (github.com)
- **GitLab** (gitlab.com, self-hosted supported)

### AI Tools and Generation Paths
- **Claude Code**
  - `.claude/rules/*.md` - Coding rules and conventions
  - `.claude/skills/*.md` - Repeatable task patterns
- **Cursor**
  - `.cursor/rules/*.md` - Coding guidelines
- **Windsurf**
  - `.windsurf/rules/*.md` - Development rules

## Installation and Setup

**⚠️ Not currently published on Chrome Web Store. Must be built and installed manually.**

```bash
git clone https://github.com/sunio00000/review-to-instruction.git
cd review-to-instruction
npm install
npm run build
```

In Chrome: `chrome://extensions` → Enable "Developer mode" → "Load unpacked" → Select `dist/` folder

## Key Features

### 🔘 Automatic Button Addition
Automatically detects PR/MR review comments and adds a "Convert to AI Instruction" button. Activates on comments containing at least one of: convention keywords (convention, rule, pattern, etc.), code examples, or emojis (✅❌).

### 🧵 Discussion Thread Unified Conversion
Detects discussion threads with 2+ comments and adds a purple "Convert Thread (N comments)" button. Converts the entire discussion's progression, consensus, and actionable conclusions into a single unified instruction.

### 🤖 LLM-based Intelligent Analysis
- **Summary and Explanation Generation**: Converts comment content into structured rules
- **Code Example Analysis**: Automatically categorizes Good/Bad examples and adds explanations
- **Smart Filenames**: Generates abstracted, generalized filenames (e.g., "button-naming" → "component-naming")
- **Project Pattern Learning**: Automatically detects naming patterns (kebab-case, PascalCase, etc.) from existing files
- **Supported LLMs**: Claude API (Anthropic), OpenAI API (GPT-4, GPT-3.5)

### 🔒 Enhanced Security
- **Master Password Encryption**: GitHub/GitLab API tokens encrypted with PBKDF2 (500,000 iterations) + AES-GCM
- **Session Persistence**: Master password maintained during browser use via chrome.storage.session
- **Auto-delete**: Master password automatically deleted on browser close
- **Dynamic Icons**: Lock status displayed in browser toolbar icon (Active/Locked/Off)

### 📝 Preserve Existing Files
When adding new rules, completely preserves existing file content. Doesn't overwrite - adds changes as `## Update (date)` sections to track history.

### 💰 Cost Optimization
- **LLM Caching**: Utilize cache for identical requests (TTL 24 hours)
- **Cost Savings**: 50-70% reduction in API call costs
- **Token Tracking**: Real-time token usage and estimated cost display
- **Duplicate Prevention**: Minimizes file count by updating existing files when similar instructions detected

## License

MIT License
