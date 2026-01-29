# Service Worker Troubleshooting Guide

## "Inactive" Status is Normal

Chrome Extension Manifest V3 Service Workers automatically become inactive when there are no events. This is **normal behavior**.

## How to Check for Real Issues

### 1. Check Service Worker Errors

1. Open Chrome extensions page: `chrome://extensions/`
2. Enable Developer mode (toggle in top right)
3. Find "Review to Instruction" extension
4. Click **"Inspect service worker"** (clickable even when inactive)
5. Check for errors in DevTools Console tab

### 2. Force Service Worker Activation Test

When Service Worker DevTools is open:
- Run the following command in Console:
  ```javascript
  console.log('Service Worker is alive!');
  chrome.runtime.getManifest();
  ```
- If manifest object outputs normally, it's working

### 3. Test Message Communication

In Service Worker DevTools Console:
```javascript
// Check storage
chrome.storage.sync.get(null, (data) => {
  console.log('Sync storage:', data);
});

chrome.storage.local.get(null, (data) => {
  console.log('Local storage:', data);
});
```

### 4. Test Communication with Content Script

1. Open a GitHub PR page (e.g., `https://github.com/*/pull/*`)
2. Press F12 on the page to open DevTools
3. In Console:
   ```javascript
   // Check if Content Script is loaded
   console.log('Review to Instruction buttons:',
     document.querySelectorAll('[data-review-to-instruction]'));
   ```

## Common Issues and Solutions

### Issue 1: Service Worker Keeps Crashing
- **Symptom**: Repeated error messages in DevTools
- **Solution**:
  1. Remove extension
  2. Restart Chrome
  3. Reinstall extension

### Issue 2: Content Script Not Working
- **Symptom**: Buttons don't appear on GitHub/GitLab PR pages
- **Solution**:
  1. Refresh page (Ctrl+R)
  2. Disable and re-enable extension
  3. Check console for errors

### Issue 3: Storage Data Disappearing
- **Symptom**: API tokens not saved or disappearing
- **Solution**:
  1. `chrome://extensions/` → "Review to Instruction" → "Inspect service worker"
  2. Check Storage in Console:
     ```javascript
     chrome.storage.local.get(null, console.log);
     ```
  3. Re-enter token in Popup if needed

## Service Worker Normal Operation Checklist

- [ ] Extension is enabled in `chrome://extensions/`
- [ ] DevTools opens when "Inspect service worker" is clicked
- [ ] No errors in DevTools Console
- [ ] Content Script buttons appear on GitHub/GitLab PR pages
- [ ] Popup settings page opens normally
- [ ] API tokens are saved correctly

## Additional Support

If the above methods don't resolve the issue:
1. Capture error messages from DevTools Console
2. Report to GitHub Issues: https://github.com/sunio00000/review-to-instruction/issues
