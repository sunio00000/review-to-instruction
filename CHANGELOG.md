# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-01-27

### Added
- Discussion Thread conversion feature
  - Automatically detects discussion threads with 2+ comments
  - Purple gradient "Convert Thread (N comments)" button on thread headers
  - Merges all thread comments into unified instruction files
  - Thread-aware LLM prompts analyzing discussion evolution and consensus
  - Smart file naming reflecting discussion topics
  - Supports both GitHub and GitLab platforms

### Changed
- Improved popup UI with fixed save button visibility
- Added Personal Access Token generation links in settings
- Integrated button settings into main view (removed separate section)

### Fixed
- Improved GitLab button placement filtering
- Fixed FormManager test failures (console.warn expectations)

## [1.2.0] - 2024-01

### Added
- Master password-based encryption for API tokens
- LLM-powered PR title and commit message summarization
- Thread analysis with reply context
- English content generation support
- Token usage tracking and display
- Intelligent keyword extraction system with context awareness

### Changed
- Made LLM functionality mandatory (removed optional LLM toggle)
- Reorganized README for better readability
- Aligned file formats with official Claude Code/Cursor/Windsurf standards
- Updated directory structure to match official provider standards

### Fixed
- Master password modal initialization flow
- Modal closing behavior when initialization fails
- Removed orphaned code from console.log cleanup

### Removed
- All console.log statements from production code

## [1.1.0] - 2024-01

### Added
- Multi-platform support (Claude Code, Cursor, Windsurf)
- Smart file matching with similarity scoring
- AI-powered file naming suggestions
- Project pattern detection (kebab-case, PascalCase, snake_case)
- LLM caching (50-70% cost reduction)
- Duplicate instruction prevention

### Changed
- Improved instruction file formatting
- Enhanced PR review instructions

### Fixed
- Various bug fixes and stability improvements

## [1.0.0] - Initial Release

### Added
- Basic comment to instruction conversion
- GitHub and GitLab support
- Manual button injection on comments
- Claude API integration
- OpenAI API integration
- Basic file generation for `.claude/rules/`

---

**Legend:**
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security vulnerability fixes

[1.3.0]: https://github.com/sunio00000/review-to-instruction/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/sunio00000/review-to-instruction/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/sunio00000/review-to-instruction/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sunio00000/review-to-instruction/releases/tag/v1.0.0
