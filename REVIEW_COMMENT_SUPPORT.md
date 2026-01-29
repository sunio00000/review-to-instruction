# Review Comment Support Guide

## Problem

Previously, the "Convert to AI Instruction" button only appeared on general PR/MR comments, not on review comments (inline code reviews, diff notes).

## Solution

### 1. Added GitHub Review Comment Selectors

Detects the following review comments on GitHub PR pages:

#### General Timeline Comments
- `.timeline-comment` - General comments in PR conversation tab

#### Review Comments
- `.review-comment` - Comments after review submission
- `.inline-comment` - Inline code review comments
- `.js-comment` - JavaScript-generated comments
- `.js-comment-container` - Comment containers

#### Discussion Comments
- `div[id^="discussion_r"]` - Comments starting with discussion ID
- `div[id^="pullrequestreview"]` - Comments starting with PR review ID

#### Body Selectors
- `.comment-body` - Default comment body
- `.js-comment-body` - JS target body
- `.review-comment-contents .comment-body` - Review comment body
- `.edit-comment-hide` - Editable comments

### 2. Added GitLab Review Comment Selectors

Detects the following review comments on GitLab MR pages:

#### General Notes
- `.note` - All GitLab notes
- `[data-testid="note"]` - data-testid attribute
- `.timeline-entry` - Timeline entries
- `.discussion-note` - Discussion notes
- `article[data-note-id]` - article with note id

#### Diff Notes (Review Comments)
- `.diff-note` - Notes inside diff
- `.note-wrapper` - Note wrapper
- `li.note` - li tag notes
- `[data-note-type="DiffNote"]` - diff note type
- `.discussion-reply-holder .note` - Reply notes

#### Body Selectors
- `.note-text` - Default note text
- `[data-testid="note-text"]` - data-testid attribute
- `.timeline-entry-body` - Timeline body
- `.note-body` - Note body
- `.js-note-text` - JS target class
- `.note-text.md` - Markdown note text
- `.note-body .note-text` - Text inside note body

## Testing Methods

### GitHub PR Page Testing

1. **General Comment Test**
   - Write a new comment in PR conversation tab
   - Verify button appears at bottom of comment

2. **Inline Review Comment Test**
   - Write a comment on a specific line in Files changed tab
   - Verify button appears at bottom of comment

3. **Post-Review Comment Test**
   - Write multiple comments with Start a review
   - Submit review with Finish your review
   - Verify button appears on each review comment

4. **Reply Comment Test**
   - Write a reply to an existing comment
   - Verify button appears on the reply as well

### GitLab MR Page Testing

1. **General Discussion Note Test**
   - Write a new comment in Overview tab
   - Verify button appears at bottom of note

2. **Diff Note Test**
   - Write a comment on a specific line in Changes tab
   - Verify button appears at bottom of diff note

3. **Thread Reply Test**
   - Write a reply to an existing discussion
   - Verify button appears on the reply as well

## Debugging

If buttons don't appear, check with browser developer tools (F12):

### 1. Check Comment Elements
```javascript
// GitHub
document.querySelectorAll('.review-comment, .inline-comment')

// GitLab
document.querySelectorAll('.diff-note, [data-note-type="DiffNote"]')
```

### 2. Check Button Containers
```javascript
document.querySelectorAll('.review-to-instruction-button-container')
```

### 3. Check Comment Bodies
```javascript
// GitHub
document.querySelectorAll('.comment-body, .js-comment-body')

// GitLab
document.querySelectorAll('.note-text, [data-testid="note-text"]')
```

## Known Limitations

1. **Pending Review Comments**: On GitHub, pending comments in "Start a review" status may not show buttons (appears after review submission)

2. **Dynamic Loading**: Comments added via infinite scroll or dynamic loading may have a slight delay (~100ms) until MutationObserver detects them

3. **Custom GitLab Instances**: GitLab Enterprise or custom instances may have different DOM structures requiring additional selectors

## Future Improvements

1. **Automatic Selector Detection**: Automatically analyze DOM structure to find appropriate selectors
2. **Performance Optimization**: Faster matching with selector priority adjustment
3. **Error Reporting**: Track and report comments where buttons weren't added
4. **A/B Testing**: Measure effectiveness of different selector combinations
