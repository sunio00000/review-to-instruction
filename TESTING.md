# Review to Instruction - Testing Guide

## Overview

This document describes the End-to-End test scenarios and validation methods for Review to Instruction.

## Prerequisites

### 1. Chrome Extension Installation

```bash
npm run build
```

1. Navigate to `chrome://extensions` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` folder

### 2. API Token Configuration

1. Click the Extension icon
2. Enter GitHub/GitLab Personal Access Token
3. Verify authentication with "Test Connection" button

**Required Permissions:**
- GitHub: `repo` (full repository access)
- GitLab: `api` (full API access)

## Test Scenarios

### Scenario 1: Create New Instruction (GitHub)

**Goal:** Generate a new instruction file from a GitHub PR comment and create a PR.

**Preparation:**
1. Create a test GitHub repository
2. Create `.claude/rules/` directory (optional)
3. Create a test PR

**Execution Steps:**

1. Navigate to the PR page
2. Write a convention-related comment:
   ```
   Our team's component naming convention.

   Component file names must use PascalCase.

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

3. Click the "Convert to AI Instruction" button below the comment
4. Verify the button status changes from "Processing..." to "Converted!"

**Verification:**

1. Check that a new PR has been created
   - PR title: "Add AI instruction: Naming Conventions" (or similar)
   - Target branch: Original PR's branch
   - Source branch: `ai-instruction/add-naming-convention` (or similar)

2. Verify PR contents
   - File path: `.claude/rules/naming-conventions.md` (or similar)
   - YAML frontmatter included
   - Code examples included
   - Source information (PR number, author, link) included

3. Verify generated file contents
   ```markdown
   ---
   title: "Naming Conventions"
   keywords: ["naming", "convention", "component"]
   category: "naming"
   created_from: "PR #1, Comment by username"
   created_at: "2026-01-15"
   last_updated: "2026-01-15"
   ---

   # Naming Conventions

   ## Rules
   Our team's component naming convention...

   ## Examples
   ...

   ## Source
   This convention was established during the review of PR #1.
   ```

### Scenario 2: Update Existing Skill (GitHub)

**Goal:** Find and update an existing skill file.

**Preparation:**
1. Create `.claude/skills/code-style.md` file:
   ```markdown
   ---
   title: "Code Style"
   keywords: ["style", "formatting"]
   category: "style"
   created_at: "2026-01-01"
   last_updated: "2026-01-01"
   ---

   # Code Style

   ## Description
   Basic code style rules
   ```

2. Write a style-related comment in a new PR:
   ```
   Functions should not exceed 50 lines.

   This is a style convention for code readability.
   ```

**Execution Steps:**
1. Click "Convert to AI Instruction" button
2. Verify the button changes to success status

**Verification:**
1. Confirm the existing file was updated (not a new file created)
2. PR title: "Update AI instruction: Code Style"
3. Verify "Additional Examples" section was added to file contents
4. Confirm keywords were merged
5. Verify `last_updated` date was updated

### Scenario 3: GitLab MR Testing

**Goal:** Verify the extension works the same on GitLab.

**Execution Steps:**
1. Navigate to a GitLab MR page
2. Write a convention-related comment
3. Click "Convert to AI Instruction" button

**Verification:**
- Same behavior as GitHub
- Verify MR is created successfully

### Scenario 4: Error Handling

**Goal:** Verify various error cases.

**Test Cases:**

1. **Non-convention General Comment**
   - Input: "This looks good!"
   - Expected: Error message "This comment does not contain convention-related content."

2. **Missing Token**
   - Remove Token from Extension settings
   - Click button
   - Expected: Error message "GitHub token is not configured."

3. **Insufficient Permissions**
   - Try on a read-only repository
   - Expected: API error message

4. **Network Error**
   - Disconnect internet and try
   - Expected: Network error message

## Performance Testing

### Response Time

- From button click to PR creation: **approximately 5-10 seconds**
  - Comment parsing: < 1 second
  - .claude/ directory exploration: 1-3 seconds
  - File generation: < 1 second
  - Branch creation: 1-2 seconds
  - PR creation: 1-2 seconds

### High Volume Comments

- PR page with 100 comments: Button addition < 2 seconds
- Performance optimized with MutationObserver debouncing

## Regression Test Checklist

Verify the following whenever there are new changes:

- [ ] Do buttons appear on GitHub PR pages?
- [ ] Do buttons appear on GitLab MR pages?
- [ ] Do buttons only work on convention-related comments?
- [ ] Are new instruction files created correctly?
- [ ] Are existing skill files updated correctly?
- [ ] Are PRs/MRs created with the correct branches?
- [ ] Are commit messages clear?
- [ ] Does the PR body include a file preview?
- [ ] Are error messages user-friendly?
- [ ] Does the API Token test work?

## Known Limitations

1. **Comments Without Code Blocks**
   - Works even without code examples, but the examples section in the generated file may be empty

2. **Complex YAML Frontmatter**
   - Currently only parses simple key:value and arrays
   - Nested objects not supported

3. **Very Long Comments**
   - PR body preview shows only up to 30 lines

4. **Duplicate Branch Names**
   - Creating multiple instructions with the same keywords may result in duplicate branch names
   - API will return an error in this case

## Debugging

If issues occur:

1. **Check Chrome DevTools Console**
   - F12 → Console tab
   - Look for logs with `[Review to Instruction]` prefix

2. **Background Service Worker Logs**
   - Go to `chrome://extensions` → Review to Instruction → Click "service worker" link

3. **Check Network Requests**
   - DevTools → Network tab
   - Check GitHub/GitLab API requests

4. **Verify Configuration**
   - Check if Token is correctly configured in Extension popup
   - Verify authentication with "Test Connection" button
