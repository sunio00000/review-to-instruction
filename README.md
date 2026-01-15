# Review to Instruction

<div align="center">

**A Chrome Extension that automatically converts GitHub/GitLab PR/MR review comments into Claude Code instructions/skills for AI agents**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF.svg)](https://vitejs.dev/)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4.svg)](https://developer.chrome.com/docs/extensions/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[![AI Generated](https://img.shields.io/badge/🤖_AI_Generated-Claude_Sonnet_4.5-8A2BE2.svg)](https://www.anthropic.com/claude)

> **Note:** This project was developed with the assistance of Claude Sonnet 4.5 AI. All code, documentation, and architecture were collaboratively created through AI-human pair programming.

</div>

---

## 📌 Overview

A tool that helps AI agents (especially Claude Code) automatically learn and utilize **conventions and patterns** established during your team's code review process.

It detects rules or patterns written in PR/MR comments by reviewers and saves them as instruction or skill files in the `.claude/` directory with **a single click**. This enables AI to automatically learn your team's coding style and rules, generating consistent code.

### ✨ Key Features

- **🔍 Auto Comment Detection**: Real-time detection of review comments on GitHub PR and GitLab MR pages
- **🎯 Smart Button Addition**: "Convert to AI Instruction" button appears only on convention-related comments
- **🧠 Keyword Extraction**: Automatically extracts convention-related keywords from comment content (English/Korean support)
- **📂 File Matching**: Matches with existing files in `.claude/skills/` directory to decide between update or new creation
- **📝 Claude Code Format Generation**: Automatically generates instruction/skills files in YAML frontmatter + Markdown format
- **🚀 Auto PR/MR Creation**: Creates new branches and automatically generates PR/MR with clear commit messages
- **🎨 Dark Mode Support**: Automatically adapts to GitHub/GitLab dark themes
- **⚡ User-Friendly UI**: Loading animations, success/error messages, PR URL links

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Build Tool**: Vite + @crxjs/vite-plugin
- **Platform**: Chrome Extension (Manifest V3)
- **API**: GitHub REST API, GitLab REST API

## 🚀 Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

Built files will be generated in the `dist/` directory.

### Load in Chrome

1. Navigate to `chrome://extensions` in Chrome
2. Enable **"Developer mode"** (top right)
3. Click **"Load unpacked"**
4. Select the `dist/` folder

## 📁 Project Structure

```
review-to-instruction/
├── src/
│   ├── content/          # Content scripts (injected into GitHub/GitLab pages)
│   ├── background/       # Background service worker
│   ├── popup/            # Extension settings popup
│   ├── core/             # Core business logic
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── public/               # Static files
└── dist/                 # Build output
```

## 📖 Usage Guide

### 1️⃣ Extension Installation & Setup

#### Load Chrome Extension

1. Clone this repository and build:
   ```bash
   git clone https://github.com/sunio00000/review-to-instruction.git
   cd review-to-instruction
   npm install
   npm run build
   ```

2. Navigate to `chrome://extensions` in Chrome
3. Enable **"Developer mode"** (top right)
4. Click **"Load unpacked"**
5. Select the `dist/` folder

#### Configure API Tokens

1. Click the Extension icon (top right in Chrome)
2. Enter Personal Access Tokens:

   **GitHub Token Creation:**
   - GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Required scope: `repo` (full repository access)
   - Copy the token and paste it in Extension settings

   **GitLab Token Creation:**
   - GitLab Settings → Access Tokens
   - Click "Add new token"
   - Required scope: `api` (full API access)
   - Copy the token and paste it in Extension settings

3. Click **"Test Connection"** to verify authentication
4. Click **"Save Settings"**

### 2️⃣ Using in PR/MR

#### Scenario 1: Create New Instruction

1. Navigate to a GitHub PR or GitLab MR page
2. Reviewer writes a convention-related comment (example):
   ```
   Our team uses PascalCase for component file names.

   Correct example:
   ```tsx
   // ✅ UserProfile.tsx
   export function UserProfile() {
     return <div>Profile</div>;
   }
   ```

   Incorrect example:
   ```tsx
   // ❌ userProfile.tsx
   export function userProfile() {
     return <div>Profile</div>;
   }
   ```
   ```

3. Click the **"Convert to AI Instruction"** button at the bottom of the comment
4. Button state: "Processing..." → "Converted!"
5. Click **"View PR →"** link in the success message
6. Review and merge the generated PR

**Result:**
- New branch: `ai-instruction/add-naming-convention`
- New file: `.claude/instructions/component-naming.md`
- PR title: "Add AI instruction: Component Naming"

#### Scenario 2: Update Existing Skill

1. When `.claude/skills/code-style.md` file already exists
2. Write a new style-related comment:
   ```
   Functions should not exceed 50 lines.
   ```

3. Click the **"Convert to AI Instruction"** button
4. Extension automatically finds and updates the existing file

**Result:**
- PR title: "Update AI instruction: Code Style"
- "Additional Cases" section added to existing file
- `last_updated` date automatically refreshed

### 3️⃣ Generated File Example

#### Instruction File (`.claude/instructions/component-naming.md`)

```markdown
---
title: "Component Naming"
keywords: ["naming", "component", "react", "convention"]
category: "naming"
created_from: "PR #123, Comment by @reviewer"
created_at: "2026-01-15"
last_updated: "2026-01-15"
---

# Component Naming

## Rules
Our team uses PascalCase for component file names.

## Examples

### Example 1

\```tsx
// ✅ UserProfile.tsx
export function UserProfile() {
  return <div>Profile</div>;
}
\```

### Example 2

\```tsx
// ❌ userProfile.tsx
export function userProfile() {
  return <div>Profile</div>;
}
\```

## Source
This convention was established during the review process of [PR #123](https://github.com/owner/repo/pull/123).
- Author: @reviewer
- Date: January 15, 2026
```

## 🚧 Development Phases

- [x] **Phase 1**: Project initialization (TypeScript, Vite, Manifest V3)
- [x] **Phase 2**: Content Script - GitHub integration (comment detection & button injection)
- [x] **Phase 3**: Content Script - GitLab integration (comment detection & button injection)
- [x] **Phase 4**: Settings popup UI (token input & storage)
- [x] **Phase 5**: Background Service Worker (API clients)
- [x] **Phase 6**: Comment parsing logic (keyword extraction, category classification)
- [x] **Phase 7**: File matching logic (.claude/ directory exploration, scoring algorithm)
- [x] **Phase 8**: Instruction/Skills generation (Claude Code format)
- [x] **Phase 9**: PR/MR creation logic (branch, commit, PR generation)
- [x] **Phase 10**: Integration & End-to-End testing
- [x] **Phase 11**: UI/UX improvements (dark mode, animations, error handling)
- [x] **Phase 12**: Documentation & deployment preparation

## 🔧 Troubleshooting

### Button Not Showing

**Causes:**
- Button display is disabled in Extension settings
- Comment is not detected as convention-related content

**Solutions:**
1. Click Extension icon → Check "Show 'Convert to Instruction' buttons"
2. Include keywords like "convention", "rule", "pattern" in comment
3. Refresh the page (F5)

### "API Token Not Configured" Error

**Solution:**
1. Click Extension icon
2. Enter GitHub or GitLab Token
3. Verify authentication with "Test Connection" button
4. Click "Save Settings"

### "Insufficient Permissions: Repository Write Access Required" Error

**Cause:**
- Personal Access Token lacks necessary permissions

**Solution:**
- **GitHub**: Ensure token includes `repo` (full) scope
- **GitLab**: Ensure token includes `api` scope
- Generate a new token and update Extension settings

### "Branch Already Exists" Error

**Cause:**
- Previously created branch has not been merged yet

**Solution:**
1. Merge or close the existing PR first
2. Or delete the branch and try again

### Debugging with Chrome DevTools

**View Content Script Logs:**
1. Press F12 (DevTools) on PR/MR page
2. Check Console tab for logs with `[Review to Instruction]` prefix

**View Background Service Worker Logs:**
1. Navigate to `chrome://extensions`
2. Find "Review to Instruction" extension
3. Click "service worker" link
4. Check logs in Console tab

## 🤝 Contributing

This project is open source and welcomes contributions!

### How to Contribute

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Create a Pull Request

### Commit Message Convention

- `feat:` - Add new feature
- `fix:` - Fix bug
- `docs:` - Update documentation
- `style:` - Code style changes (no functional changes)
- `refactor:` - Code refactoring
- `test:` - Add or update tests
- `chore:` - Build configuration, package manager, etc.

### Bug Reports & Feature Requests

Please submit bug reports or feature requests through GitHub Issues!

## 📚 Related Documentation

- [TESTING.md](./TESTING.md) - Testing guide and scenarios
- [Claude Code Documentation](https://docs.anthropic.com/claude/docs) - Claude Code plugin format guide
- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/)

## ❓ FAQ

### Q1: What comments are detected as "convention-related"?

Comments containing the following keywords are detected:
- "convention", "rule", "pattern", "guideline", "standard"
- Korean equivalents: "컨벤션", "규칙", "패턴", "가이드라인"
- "should", "must", "always", "never"
- Or structured explanations with code examples (```)

### Q2: How are file categories determined?

Comment content is analyzed and automatically classified into one of these categories:
- `naming` - Variable, function, class naming
- `style` - Code style and formatting
- `architecture` - System design and structure
- `testing` - Testing patterns
- `security` - Security-related rules
- `performance` - Performance optimization
- `error-handling` - Error handling patterns
- `documentation` - Documentation rules

### Q3: Does it work with GitLab self-hosted instances?

Currently only `gitlab.com` is supported. Self-hosted GitLab support is planned for future releases.

### Q4: Can generated PRs be automatically merged?

For security and quality control, automatic merge functionality is not provided. We recommend having team members review and manually merge generated PRs.

### Q5: Can multiple comments be processed at once?

Currently, each comment requires an individual button click. Batch processing is planned for future releases.

## 📝 License

MIT License - Free to use, modify, and distribute.

See the [LICENSE](./LICENSE) file for details.

## 🎯 Roadmap

### v1.1 (Planned)
- [ ] GitLab self-hosted support
- [ ] Batch processing (process multiple comments at once)
- [ ] AI-powered automatic category classification improvements
- [ ] Team-specific custom keyword dictionaries
- [ ] Statistics dashboard (instruction count, category distribution)

### v1.2 (Planned)
- [ ] Bitbucket support
- [ ] Azure DevOps support
- [ ] Comment template features
- [ ] Automatic PR review analysis

## 🙏 Acknowledgments

This project was made possible by these open source projects:
- [Vite](https://vitejs.dev/) - Fast build tool
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [@crxjs/vite-plugin](https://github.com/crxjs/chrome-extension-tools) - Chrome Extension build plugin
- [Claude Code](https://claude.com/claude-code) - AI agent plugin format

## 📧 Contact

For questions or suggestions, please reach out through [GitHub Issues](https://github.com/sunio00000/review-to-instruction/issues)!

---

<div align="center">

**Made with ❤️ by the Review to Instruction team**

⭐ If this project helped you, please star it!

</div>
