# v1.0.0 - Initial Release

**Release Date:** 2026-01-29

## 🎉 What's New

First public release of **Review to Instruction** - A Chrome extension that automatically converts GitHub/GitLab PR review comments into AI-readable instruction files for Claude Code, Cursor, and Windsurf.

---

## ✨ Key Features

### 🔘 Automatic Button Addition
Automatically detects PR/MR review comments and adds a **"Convert to AI Instruction"** button.

**Activation criteria** (at least one of):
- Convention keywords (convention, rule, pattern, should, must, etc.)
- Code examples (``` blocks or inline `code`)
- Emojis (✅ ❌ 🚫 etc.)

### 🧵 Discussion Thread Unified Conversion
Detects discussion threads with 2+ comments and adds a purple **"Convert Thread (N comments)"** button in the comment header.

**Benefits:**
- Converts entire discussion progression into unified instruction
- Captures consensus and actionable conclusions
- Prevents fragmented rules from individual comments

### 🤖 LLM-based Intelligent Analysis
- **Summary and Explanation Generation**: Converts comment content into structured rules
- **Code Example Analysis**: Automatically categorizes Good/Bad examples with explanations
- **Smart Filenames**: Generates abstracted, generalized filenames
  - Example: "button-naming" → "component-naming"
- **Project Pattern Learning**: Automatically detects naming patterns from existing files
  - Supports: kebab-case, PascalCase, camelCase, snake_case
- **Supported LLMs**:
  - Claude API (Anthropic) - Claude 3.5 Sonnet, Claude 3 Opus
  - OpenAI API - GPT-4, GPT-3.5

### 🔒 Enhanced Security
- **Master Password Encryption**:
  - GitHub/GitLab API tokens encrypted with PBKDF2 (500,000 iterations) + AES-GCM
  - Master password required to unlock tokens
- **Session Persistence**:
  - Master password maintained during browser use via `chrome.storage.session`
  - Auto-deleted on browser close
- **Dynamic Icons**:
  - Lock status displayed in browser toolbar icon
  - States: 🟢 Active / 🔒 Locked / ⚫ Off

### 📝 Preserve Existing Files
When adding new rules, completely preserves existing file content.

**How it works:**
- Doesn't overwrite existing rules
- Adds changes as `## Update (YYYY-MM-DD)` sections
- Tracks instruction history chronologically

### 💰 Cost Optimization
- **LLM Caching**:
  - Utilize cache for identical requests (TTL 24 hours)
  - 50-70% reduction in API call costs
- **Token Tracking**:
  - Real-time token usage display
  - Estimated cost calculation
- **Duplicate Prevention**:
  - Minimizes file count by updating existing files when similar instructions detected

---

## 🎯 Supported Platforms

### Git Platforms
- ✅ **GitHub** (github.com)
- ✅ **GitLab** (gitlab.com, self-hosted supported)

### AI Tools and Generation Paths
| AI Tool | Generation Path | Description |
|---------|----------------|-------------|
| **Claude Code** | `.claude/rules/*.md` | Coding rules and conventions |
| | `.claude/skills/*.md` | Repeatable task patterns |
| **Cursor** | `.cursor/rules/*.md` | Coding guidelines |
| **Windsurf** | `.windsurf/rules/*.md` | Development rules |

---

## 📦 Installation

**⚠️ Not currently published on Chrome Web Store. Must be built and installed manually.**

### Build from Source

```bash
git clone https://github.com/sunio00000/review-to-instruction.git
cd review-to-instruction
npm install
npm run build
```

### Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **"Developer mode"** (top right toggle)
3. Click **"Load unpacked"**
4. Select the `dist/` folder from the build output

---

## 🚀 Quick Start

1. **Configure API Tokens**:
   - Click extension icon in browser toolbar
   - Set master password
   - Add GitHub/GitLab API tokens
   - Select LLM provider (Claude or OpenAI) and configure API key

2. **Convert Comments**:
   - Navigate to any GitHub PR or GitLab MR
   - Find review comments with convention keywords or code examples
   - Click **"Convert to AI Instruction"** button
   - Preview generated instruction and confirm

3. **Convert Threads** (optional):
   - Look for purple **"Convert Thread"** button in comment headers
   - Click to convert entire discussion into unified instruction

---

## 🔧 Technical Stack

- **Framework**: Vite 7.3.1 + TypeScript 5.9.3
- **Architecture**: Chrome Extension Manifest V3
- **Testing**: Vitest + Playwright
- **Build**: TypeScript compilation + Vite bundling

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 Credits

Built with ❤️ for AI-assisted development workflows.

Special thanks to the Claude Code, Cursor, and Windsurf communities.

---

## 📝 Notes

This is the initial public release. Please report any issues or feature requests on [GitHub Issues](https://github.com/sunio00000/review-to-instruction/issues).

