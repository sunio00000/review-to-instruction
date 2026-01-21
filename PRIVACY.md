# Privacy Policy - Review to Instruction

**Last updated: January 21, 2026**

## Overview

Review to Instruction is a Chrome Extension that automatically converts GitHub/GitLab review comments into AI-agent instructions and skills. We are committed to protecting your privacy and ensuring the security of your personal data.

## Data Collection

**We do NOT collect, store, or transmit any personal data to external servers.**

All data processing happens locally on your device, and no information is sent to our servers or third parties (except for the API services you explicitly configure).

## Data Storage

### API Keys and Tokens

All sensitive credentials are encrypted and stored securely:

- **Encryption Method**: AES-GCM 256-bit encryption with PBKDF2 key derivation
- **Master Password**: Encryption key is derived from your master password using PBKDF2 with 500,000 iterations
- **Storage Location**: chrome.storage.local (local browser storage, not synchronized)
- **No External Transmission**: API keys are NEVER sent to our servers

### What We Store Locally

The following data is stored encrypted in your browser's local storage:

1. **GitHub Personal Access Token** (optional)
2. **GitLab Personal Access Token** (optional)
3. **Claude API Key** (optional, if LLM feature is enabled)
4. **OpenAI API Key** (optional, if LLM feature is enabled)
5. **GitLab URL** (unencrypted, for self-hosted instances)

### Master Password

- Your master password is **never** stored anywhere
- A one-way SHA-256 hash is stored for verification purposes only
- If you lose your master password, all encrypted API keys will be inaccessible and you will need to re-enter them

### LLM Response Cache

When using the optional LLM feature, responses are cached locally to:
- Reduce API costs
- Improve response times
- Minimize redundant API calls

**Cache contents**:
- Review comment text (hashed as cache key)
- LLM-generated analysis results
- Cache statistics (hits, misses, size)

**Cache security**:
- Stored in chrome.storage.local (unencrypted)
- Contains only processed results, not raw API keys
- Can be cleared anytime via the extension settings

## Third-party Services

This extension connects to the following external APIs **only when you configure them**:

### GitHub API (github.com)
- **Purpose**: Test API connection and retrieve repository information
- **Data sent**: Personal Access Token (in request header)
- **Data received**: User profile information
- **Privacy Policy**: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement

### GitLab API (gitlab.com or self-hosted)
- **Purpose**: Test API connection and retrieve repository information
- **Data sent**: Personal Access Token (in request header)
- **Data received**: User profile information
- **Privacy Policy**: https://about.gitlab.com/privacy/

### Anthropic Claude API (api.anthropic.com) - Optional
- **Purpose**: Analyze review comments and generate structured instructions
- **Data sent**: Review comment text, code examples, API key (in request header)
- **Data received**: AI-generated analysis results
- **Privacy Policy**: https://www.anthropic.com/legal/privacy

### OpenAI API (api.openai.com) - Optional
- **Purpose**: Analyze review comments and generate structured instructions
- **Data sent**: Review comment text, code examples, API key (in request header)
- **Data received**: AI-generated analysis results
- **Privacy Policy**: https://openai.com/policies/privacy-policy

**Important**: API keys are transmitted directly from your browser to these services using HTTPS encryption. We do NOT intercept, log, or store these transmissions.

## Permissions

This extension requests the following Chrome permissions:

### storage
- **Purpose**: Store encrypted API keys and extension settings locally
- **Access**: chrome.storage.local only (not synced across devices)

### activeTab
- **Purpose**: Inject content script into GitHub/GitLab PR pages
- **Access**: Only when you navigate to a PR page
- **Data accessed**: PR comments and code snippets (processed locally)

### host_permissions
- **Hosts**:
  - `https://github.com/*`
  - `https://gitlab.com/*`
  - `https://git.projectbro.com/*` (example self-hosted GitLab)
- **Purpose**: Inject content script and make API calls
- **Data sent**: API tokens (encrypted) for authentication only

## Data Security

### Encryption Details

- **Algorithm**: AES-GCM (Galois/Counter Mode)
- **Key Length**: 256 bits
- **Key Derivation**: PBKDF2 with 500,000 iterations and SHA-256
- **IV (Initialization Vector)**: 12 bytes, randomly generated for each encryption
- **Authentication**: AES-GCM provides built-in authentication

### Protection Measures

1. **Master Password Required**: All API keys are encrypted with your master password
2. **No Password Storage**: Master password exists only in memory during your session
3. **Secure Key Derivation**: PBKDF2 with 500K iterations prevents brute-force attacks
4. **Local Processing**: All encryption/decryption happens on your device
5. **No External Transmission**: Encrypted keys never leave your browser

### Limitations

While we use industry-standard encryption, please be aware:

- **Browser DevTools Access**: If malicious software has access to your browser's developer tools, it may be able to access decrypted API keys in memory
- **XSS Vulnerabilities**: We follow secure coding practices, but no software is 100% secure
- **Physical Access**: If someone has physical access to your unlocked computer, they may access your data

**Recommendation**: Only use this extension on trusted devices and keep your master password secure.

## Data Retention

### API Keys and Settings
- Stored encrypted until you manually delete them via extension settings
- Automatically deleted if you reset your master password

### Master Password Hash
- Stored until you reset your master password
- Cannot be used to recover your original password

### LLM Response Cache
- Retained indefinitely until you manually clear it
- Can be cleared via extension settings → "Cache Management" section

### Uninstallation
- All data (API keys, cache, settings) is permanently deleted when you uninstall the extension
- No data remains in chrome.storage.local after uninstallation

## Analytics and Tracking

**We do NOT use any analytics, tracking, or telemetry tools.**

- No Google Analytics
- No crash reporting
- No usage statistics
- No cookies
- No fingerprinting

## Children's Privacy

This extension is not directed to children under the age of 13. We do not knowingly collect personal information from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be indicated by updating the "Last updated" date at the top of this policy.

## Open Source

This extension is open source. You can review the source code at: [GitHub Repository URL]

## Contact

For privacy concerns or questions, please contact:
- Email: [your-email@example.com]
- GitHub Issues: [Repository URL]/issues

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- GDPR (General Data Protection Regulation) - for EU users
- CCPA (California Consumer Privacy Act) - for California users

## Your Rights

You have the right to:
- **Access**: View all data stored by this extension via chrome.storage
- **Delete**: Clear all stored data by resetting your master password or uninstalling
- **Export**: No export feature needed as all data is local
- **Opt-out**: Disable LLM features or uninstall the extension at any time

## Security Best Practices

To maximize security when using this extension:

1. **Use a Strong Master Password**: At least 12 characters with letters, numbers, and symbols
2. **Don't Share Your Master Password**: It should be known only to you
3. **Use Read-Only API Tokens**: When possible, generate API tokens with minimal permissions
4. **Clear Cache Regularly**: Clear LLM response cache if it contains sensitive code snippets
5. **Keep Extension Updated**: Install updates promptly for security fixes

---

**By using this extension, you acknowledge that you have read and understood this Privacy Policy.**
