/**
 * Test Server for E2E Tests
 * Provides mock GitHub/GitLab pages
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3002;

// Serve static files
app.use(express.static(path.join(__dirname, 'fixtures')));

// GitHub PR page with convention comment
app.get('/test-org/test-repo/pull/:prNumber', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test PR - GitHub</title>
  <style>
    .timeline-comment {
      border: 1px solid #ddd;
      margin: 10px;
      padding: 10px;
    }
    .comment-body {
      padding: 10px;
    }
  </style>
</head>
<body>
  <h1>Pull Request #1: Test PR</h1>

  <!-- Convention comment (should show button) -->
  <div data-comment-id="comment-1" class="timeline-comment">
    <div class="comment-body">
      <p>우리 팀의 컴포넌트 네이밍 컨벤션입니다.</p>
      <p>컴포넌트 파일명은 PascalCase를 사용해야 합니다.</p>
      <pre><code class="language-tsx">
// ✅ UserProfile.tsx
export function UserProfile() {
  return <div>Profile</div>;
}
      </code></pre>
    </div>
  </div>

  <!-- General comment (should NOT show button) -->
  <div data-comment-id="comment-2" class="timeline-comment">
    <div class="comment-body">
      <p>This looks good to me! 👍</p>
    </div>
  </div>

  <!-- Another convention comment -->
  <div data-comment-id="comment-3" class="timeline-comment">
    <div class="comment-body">
      <p>함수는 최대 50줄을 넘지 않도록 합니다.</p>
    </div>
  </div>
</body>
</html>
  `;

  res.send(html);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Test server closed');
    process.exit(0);
  });
});
