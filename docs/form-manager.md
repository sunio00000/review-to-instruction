# FormManager Usage Guide

## Table of Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Field Schema Guide](#field-schema-guide)
- [Adding New Fields](#adding-new-fields)
- [Validation System](#validation-system)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

---

## Overview

### What is FormManager?

**FormManager** is a class that declaratively manages form fields in Chrome Extension popups. It eliminates manual DOM manipulation and automates form behavior through schema-based configuration.

### Key Features

✅ **DOM Element Caching**: Fast access using Map
✅ **Automatic Encryption**: CryptoService integration for sensitive data protection
✅ **Auto-sync**: Bidirectional synchronization with chrome.storage.local
✅ **Validation Rules**: Required input, regex, custom validation support
✅ **Conditional Visibility**: Show/hide fields based on other field values
✅ **Auto-remove Empty Values**: Cleanup unnecessary data with storage.remove

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  FormManager                        │
│                                                     │
│  ┌───────────────┐         ┌──────────────────┐   │
│  │ Field Schema  │ ──────> │  DOM Elements    │   │
│  │  (Declarative)│         │  (Auto-binding)  │   │
│  └───────────────┘         └──────────────────┘   │
│         │                           │              │
│         │                           │              │
│         v                           v              │
│  ┌───────────────┐         ┌──────────────────┐   │
│  │ Validation    │         │  Visibility      │   │
│  │ (Auto-check)  │         │  (Conditional)   │   │
│  └───────────────┘         └──────────────────┘   │
│         │                           │              │
│         v                           v              │
│  ┌──────────────────────────────────────────────┐ │
│  │        chrome.storage.local                  │ │
│  │   (Auto-encryption + Auto-remove empty)      │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Core Benefits

| Previous Method (Manual)       | FormManager Method (Declarative) |
|-------------------------------|----------------------------------|
| Manually query DOM elements   | Automatic caching                |
| Repeated read/write code      | Auto-sync                        |
| Scattered validation logic    | Concentrated in schema           |
| Duplicated encryption code    | Automatic CryptoService integration |
| Complex conditional display   | Simple visible function          |

---

## Quick Start

### 1. Define Field Schema

Define fields declaratively in `src/popup/form-schema.ts`:

```typescript
import { FieldSchema, FormState } from '../types/form-manager';

export const popupFormSchema: FieldSchema[] = [
  // Basic text field
  {
    id: 'github-token',              // DOM element ID
    storageKey: 'githubToken_enc',   // chrome.storage key
    type: 'password',                // Field type
    encrypted: true,                 // Encryption enabled
    validation: {
      pattern: /^ghp_[a-zA-Z0-9]{36,}$/,
      message: 'GitHub token must start with "ghp_".'
    }
  },

  // Checkbox field
  {
    id: 'show-buttons',
    storageKey: 'showButtons',
    type: 'checkbox',
    encrypted: false,
    defaultValue: true               // Set default value
  },

  // Conditional visibility field
  {
    id: 'claude-api-key',
    storageKey: 'claudeApiKey_enc',
    type: 'password',
    encrypted: true,
    visible: (state: FormState) => state['llm-provider'] === 'claude'
  }
];
```

### 2. Initialize FormManager

Create FormManager instance in `src/popup/popup.ts`:

```typescript
import { CryptoService } from '../background/services/crypto-service';
import { FormManager } from '../utils/form-manager';
import { popupFormSchema } from './form-schema';

// Create CryptoService instance
const crypto = new CryptoService();

// Create FormManager instance
const formManager = new FormManager(popupFormSchema, crypto);

// Bind DOM elements
formManager.bindElements();

// Enable automatic conditional visibility updates
formManager.bindVisibilityUpdates();

// Load settings
await formManager.load();
```

### 3. Save Settings

```typescript
async function saveConfig() {
  const result = await formManager.save();

  if (result.isValid) {
    console.log('✅ Settings saved.');
  } else {
    // Display validation errors
    result.errors.forEach((message, fieldId) => {
      console.error(`${fieldId}: ${message}`);
    });
  }
}
```

### 4. Read/Write Values

```typescript
// Read specific field value
const githubToken = formManager.getValue('github-token');

// Set specific field value
formManager.setValue('show-buttons', false);

// Read entire state
const state = formManager.getState();
console.log(state); // { 'github-token': 'ghp_...', 'show-buttons': true, ... }
```

---

## Field Schema Guide

### FieldSchema Properties

| Property     | Type                          | Required | Description                               |
|--------------|-------------------------------|----------|-------------------------------------------|
| `id`         | `string`                      | ✅       | DOM element ID                            |
| `storageKey` | `string`                      | ✅       | Key to store in chrome.storage.local      |
| `type`       | `'text' \| 'password' \| 'checkbox' \| 'select'` | ✅ | Field type |
| `encrypted`  | `boolean`                     | ✅       | Whether to encrypt storage (true for sensitive data) |
| `defaultValue` | `string \| boolean`        | ❌       | Default value (used when no value exists) |
| `validation` | `ValidationRule`              | ❌       | Validation rules                          |
| `visible`    | `(state: FormState) => boolean` | ❌     | Conditional visibility function           |

### Field Type Features

#### 1. `text` / `password`
- General text input fields
- Uses `value` property
- Automatically applies `.trim()` when reading/writing values

```typescript
{
  id: 'gitlab-url',
  storageKey: 'gitlabUrl',
  type: 'text',
  encrypted: false,
  defaultValue: 'https://gitlab.com'
}
```

#### 2. `checkbox`
- Checkboxes
- Uses `checked` property
- Value is `boolean` type
- **Important**: `false` is also considered a valid value (not empty)

```typescript
{
  id: 'llm-enabled',
  storageKey: 'llmEnabled',
  type: 'checkbox',
  encrypted: false,
  defaultValue: false
}
```

#### 3. `select`
- Dropdown selection
- Uses `value` property
- Value is `string` type

```typescript
{
  id: 'llm-provider',
  storageKey: 'llmProvider',
  type: 'select',
  encrypted: false,
  defaultValue: 'none'
}
```

### ValidationRule Properties

| Property   | Type                            | Description                                |
|-----------|---------------------------------|--------------------------------------------|
| `required` | `boolean`                      | Whether input is required                  |
| `pattern`  | `RegExp`                       | Regex pattern validation (strings only)    |
| `message`  | `string`                       | Message to display on validation failure   |
| `custom`   | `(value: any) => boolean \| string` | Custom validation function (true=success, false or message=failure) |

### Conditional Visibility

Use the `visible` function to show/hide fields based on other field values.

```typescript
{
  id: 'claude-api-key',
  storageKey: 'claudeApiKey_enc',
  type: 'password',
  encrypted: true,
  // Only display when llm-provider value is 'claude'
  visible: (state: FormState) => state['llm-provider'] === 'claude'
}
```

**How it works:**
- `visible` function returns `true` → Field shown
- `visible` function returns `false` → Field hidden
- Controls `display` style of nearest `.input-group` or `.form-group` element

**Automatic Updates:**
- Automatically registers event listeners when `bindVisibilityUpdates()` is called
- Automatically re-evaluates visibility when other field values change

---

## Adding New Fields

Complete step-by-step process for adding a new field.

### Example: Adding Anthropic API Key Field

#### Step 1: Add Field to HTML

Add new field in `src/popup/popup.html`:

```html
<div class="form-group">
  <label for="anthropic-api-key">
    Anthropic API Key
    <span class="security-badge">🔒 Encrypted Storage</span>
  </label>
  <div class="input-group">
    <input
      type="password"
      id="anthropic-api-key"
      placeholder="sk-ant-api..."
    />
  </div>
  <div id="anthropic-status" class="status"></div>
</div>
```

#### Step 2: Add Field Definition to Schema

Add field schema in `src/popup/form-schema.ts`:

```typescript
export const popupFormSchema: FieldSchema[] = [
  // ... existing fields ...

  // New Anthropic API Key field
  {
    id: 'anthropic-api-key',              // Matches input id in HTML
    storageKey: 'anthropicApiKey_enc',    // chrome.storage key (_enc indicates encryption convention)
    type: 'password',                     // Password field
    encrypted: true,                      // Encrypt storage
    validation: {
      pattern: /^sk-ant-[a-zA-Z0-9_-]{95,}$/,  // Anthropic API key pattern
      message: 'Anthropic API key must start with "sk-ant-".'
    },
    visible: (state: FormState) => state['llm-provider'] === 'anthropic'  // Conditional display
  }
];
```

#### Step 3: Usage (Automatic!)

FormManager handles everything automatically, no additional code needed:

```typescript
// ✅ Automatically restores value on load
await formManager.load();

// ✅ Automatically encrypts and saves
await formManager.save();

// ✅ Direct access available if needed
const apiKey = formManager.getValue('anthropic-api-key');
```

#### Step 4: Testing

1. Open Extension popup
2. Enter value in field
3. Click "Save" button
4. Check DevTools Console:
   ```
   [FormManager] Saved 1 fields, removed 0 empty fields
   ```
5. Verify value persists after extension restart

### Field Addition Checklist

- [ ] Add DOM element to HTML (`id` attribute required)
- [ ] Add FieldSchema to schema file
- [ ] Check for duplicate `id` and `storageKey`
- [ ] Set `encrypted: true` for sensitive data requiring encryption
- [ ] Define validation rules (if needed)
- [ ] Add `visible` function if conditional display needed
- [ ] Rebuild extension (`npm run build`)
- [ ] Reload extension (chrome://extensions)
- [ ] Test: Save → Restart → Verify load

---

## Validation System

FormManager supports 3 validation methods.

### 1. Required Input Validation (required)

Does not allow empty values.

```typescript
{
  id: 'github-token',
  storageKey: 'githubToken_enc',
  type: 'password',
  encrypted: true,
  validation: {
    required: true,
    message: 'Please enter GitHub token.'
  }
}
```

**Empty value criteria:**
- `undefined`, `null`
- Empty string (`''`, strings with only whitespace like `'   '`)

### 2. Regex Pattern Validation (pattern)

Checks if input matches a specific pattern.

```typescript
{
  id: 'github-token',
  storageKey: 'githubToken_enc',
  type: 'password',
  encrypted: true,
  validation: {
    pattern: /^ghp_[a-zA-Z0-9]{36,}$/,
    message: 'GitHub token must start with "ghp_".'
  }
}
```

**Behavior:**
- **Validates strings only** (`type: 'text'`, `'password'`)
- Skips pattern validation for empty values (use with required validation)

### 3. Custom Validation (custom)

Define complex validation logic as a function.

```typescript
{
  id: 'gitlab-url',
  storageKey: 'gitlabUrl',
  type: 'text',
  encrypted: false,
  validation: {
    custom: (value: string) => {
      try {
        new URL(value);
        return true;  // Validation success
      } catch {
        return 'Invalid URL format.';  // Validation failure (error message)
      }
    }
  }
}
```

**Return values:**
- `true`: Validation success
- `false`: Validation failure (use default message)
- `string`: Validation failure (custom message)

### Combined Validation Example

Multiple validation rules can be combined:

```typescript
{
  id: 'gitlab-url',
  storageKey: 'gitlabUrl',
  type: 'text',
  encrypted: false,
  validation: {
    required: true,                           // 1. Required input
    pattern: /^https?:\/\/.+$/,               // 2. Starts with http(s)://
    message: 'URL must start with http:// or https://.',
    custom: (value: string) => {              // 3. URL object creation possible
      try {
        new URL(value);
        return true;
      } catch {
        return 'Invalid URL format.';
      }
    }
  }
}
```

**Validation order:**
1. `required` validation → Returns immediately on failure
2. `pattern` validation → Returns immediately on failure
3. `custom` validation → Returns immediately on failure

### Handling Validation Results

```typescript
async function saveConfig() {
  const result = await formManager.save();

  if (result.isValid) {
    console.log('✅ Save successful');
  } else {
    // Handle validation errors
    result.errors.forEach((message, fieldId) => {
      console.error(`❌ ${fieldId}: ${message}`);

      // Display error in UI
      const statusElement = document.getElementById(`${fieldId}-status`);
      if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'status error';
      }
    });
  }
}
```

**ValidationResult structure:**
```typescript
interface ValidationResult {
  isValid: boolean;               // Overall validation success
  errors: Map<string, string>;    // fieldId -> error message
}
```

### Error Message Priority

Error messages on validation failure are determined by this priority:

1. `string` returned by `custom` function (highest priority)
2. `ValidationRule.message`
3. Default message (e.g., `${fieldId} is a required field.`)

---

## Troubleshooting

### 1. Field values not loading

**Symptom:**
```
[FormManager] Element not found: #my-field
```

**Cause:**
- No element with that ID in HTML
- DOM not ready before `bindElements()` call

**Solution:**
```typescript
// ✅ Call after DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
  formManager.bindElements();
  formManager.load();
});

// ❌ Wrong approach
formManager.bindElements();  // Called before DOM ready
```

### 2. Encrypted values not decrypting

**Symptom:**
```
[FormManager] Decryption failed for github-token: Error: ...
```

**Cause:**
- CryptoService initialization failure
- Data saved with previous version's encryption key

**Solution:**
```typescript
// Verify CryptoService initialized correctly
const crypto = new CryptoService();
await crypto.init();  // Generate SubtleCrypto key

// Delete existing data and re-save
await chrome.storage.local.remove('githubToken_enc');
```

### 3. Conditional fields not displaying

**Symptom:**
- Field remains hidden even though `visible` function returns `true`

**Cause:**
- Missing `bindVisibilityUpdates()` call
- Missing `updateVisibility()` call after state update

**Solution:**
```typescript
// ✅ Enable automatic updates on initialization
formManager.bindElements();
formManager.bindVisibilityUpdates();  // Register event listeners

// ✅ When manually changing value
formManager.setValue('llm-provider', 'claude');
// updateVisibility() automatically called inside setValue
```

### 4. Validation not working

**Symptom:**
- Saves even with incorrect values entered

**Cause:**
- Error in `validation` rule definition

**Debugging:**
```typescript
// Check validation result directly
const result = formManager.validate();
console.log('Valid:', result.isValid);
console.log('Errors:', result.errors);

// Check specific field value
const value = formManager.getValue('github-token');
console.log('Value:', value);
```

### 5. Empty values not removed from storage

**Symptom:**
- Value remains in `chrome.storage.local.get()` even after clearing field

**Cause:**
- `type: 'checkbox'` is not subject to empty value removal (false is also a valid value)

**Solution:**
```typescript
// Empty strings automatically removed for non-checkboxes
// To manually remove:
await chrome.storage.local.remove('storageKey');
```

### 6. FormManager Initialization Error

**Symptom:**
```
[FormManager] Field schema is empty.
```

**Cause:**
- `fields` array is empty

**Solution:**
```typescript
// ✅ Correct initialization
const fields: FieldSchema[] = [
  { id: 'my-field', storageKey: 'myField', type: 'text', encrypted: false }
];
const formManager = new FormManager(fields, crypto);

// ❌ Wrong initialization
const formManager = new FormManager([], crypto);  // Empty array
```

---

## API Reference

### FormManager Class

#### Constructor

```typescript
constructor(fields: FieldSchema[], crypto: CryptoService)
```

**Parameters:**
- `fields`: Field schema array
- `crypto`: CryptoService instance (for encryption/decryption)

**Exceptions:**
- Error thrown if `fields` is empty array
- Error thrown if `crypto` is null

---

#### bindElements(): void

Finds DOM elements and caches them in internal Map.

```typescript
formManager.bindElements();
```

**Behavior:**
- Calls `document.getElementById()` for each field's `id`
- Outputs warning log and continues if element not found
- Stores found elements in `Map<string, HTMLElement>`

**Log:**
```
[FormManager] 8/8 elements bound
```

---

#### load(): Promise<void>

Reads values from chrome.storage.local and reflects them in DOM.

```typescript
await formManager.load();
```

**Behavior:**
1. Generate list of all fields' `storageKey`
2. Batch query with `chrome.storage.local.get()`
3. Set value for each field:
   - Use `defaultValue` if no value exists
   - Automatically decrypt fields with `encrypted: true`
   - Set value in DOM element
4. Update conditional visibility

**Error Handling:**
- Sets empty value and outputs warning log on decryption failure

---

#### save(): Promise<ValidationResult>

Reads values from DOM and saves to chrome.storage.local.

```typescript
const result = await formManager.save();

if (result.isValid) {
  console.log('Save successful');
} else {
  console.error('Validation failed:', result.errors);
}
```

**Behavior:**
1. Execute validation (`validate()`)
2. Return immediately without saving on validation failure
3. Read values from DOM
4. Add empty values to removal list
5. Automatically encrypt fields with `encrypted: true`
6. Batch save with `chrome.storage.local.set()`
7. Batch delete with `chrome.storage.local.remove()`

**Log:**
```
[FormManager] Saved 5 fields, removed 2 empty fields
```

**Returns:**
- `ValidationResult` object

---

#### validate(): ValidationResult

Executes validation rules for all fields.

```typescript
const result = formManager.validate();

if (!result.isValid) {
  result.errors.forEach((message, fieldId) => {
    console.error(`${fieldId}: ${message}`);
  });
}
```

**Returns:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: Map<string, string>;  // fieldId -> error message
}
```

---

#### updateVisibility(): void

Updates conditional visibility.

```typescript
formManager.updateVisibility();
```

**Behavior:**
1. Refresh current state (`refreshCurrentState()`)
2. Execute each field's `visible` function
3. Show/hide DOM element based on return value

**Target elements:**
1. `.input-group` (priority)
2. `.form-group` (fallback)
3. Element itself (final fallback)

---

#### getValue(fieldId: string): any

Returns current value of a specific field.

```typescript
const token = formManager.getValue('github-token');
console.log(token);  // 'ghp_...'
```

**Returns:**
- Value matching field type
- `undefined` if element not found

---

#### setValue(fieldId: string, value: any): void

Sets value for a specific field.

```typescript
formManager.setValue('show-buttons', false);
```

**Behavior:**
1. Set value in DOM element
2. Update internal state
3. Re-evaluate conditional visibility

---

#### getState(): FormState

Returns entire form state.

```typescript
const state = formManager.getState();
console.log(state);
// {
//   'github-token': 'ghp_...',
//   'show-buttons': true,
//   'llm-enabled': false,
//   ...
// }
```

**Returns:**
- `FormState` object (current values of all fields)

---

#### bindVisibilityUpdates(): void

Registers event listeners to automatically update visibility on state changes.

```typescript
formManager.bindVisibilityUpdates();
```

**Behavior:**
- Adds appropriate event listeners to each field:
  - `checkbox`, `select` → `'change'` event
  - `text`, `password` → `'input'` event
- Automatically calls `updateVisibility()` on event

---

### FieldSchema Interface

```typescript
interface FieldSchema {
  id: string;                                     // DOM element ID
  storageKey: string;                             // chrome.storage key
  type: 'text' | 'password' | 'checkbox' | 'select';  // Field type
  encrypted: boolean;                             // Encrypt storage
  defaultValue?: string | boolean;                // Default value
  validation?: ValidationRule;                    // Validation rules
  visible?: (state: FormState) => boolean;        // Conditional visibility
}
```

---

### ValidationRule Interface

```typescript
interface ValidationRule {
  required?: boolean;                             // Required input
  pattern?: RegExp;                               // Regex pattern
  message?: string;                               // Error message
  custom?: (value: any) => boolean | string;      // Custom validation
}
```

---

### ValidationResult Interface

```typescript
interface ValidationResult {
  isValid: boolean;                               // Validation success
  errors: Map<string, string>;                    // fieldId -> error message
}
```

---

### FormState Type

```typescript
type FormState = Record<string, any>;
```

Type representing entire form state. Uses each field's ID as key and value as value.

**Example:**
```typescript
const state: FormState = {
  'github-token': 'ghp_abcd1234...',
  'show-buttons': true,
  'llm-enabled': false,
  'llm-provider': 'claude'
};
```

---

## Appendix

### Naming Conventions

| Item            | Convention              | Example                       |
|----------------|-------------------------|-------------------------------|
| Field ID        | kebab-case              | `github-token`                |
| storageKey      | camelCase               | `githubToken_enc`             |
| Encrypted field suffix | `_enc`           | `claudeApiKey_enc`            |

### Security Recommendations

1. **Always encrypt sensitive data**
   - Set `encrypted: true` for API tokens, passwords, etc.
   - Add `_enc` suffix to storageKey (convention)

2. **Avoid direct chrome.storage.local access**
   - Access only through FormManager
   - Ensures consistency and encryption

3. **Always define validation rules**
   - Add `pattern` validation for sensitive fields
   - Early detection of format errors

### Performance Optimization

1. **DOM Caching**: Query elements only once with `bindElements()`
2. **Batch Processing**: Batch call `chrome.storage.local.set()`
3. **Event Delegation**: Can remove unnecessary event listeners

---

## Related Documentation

- [CryptoService Documentation](./crypto-service.md) - Encryption/Decryption API
- [TESTING.md](../TESTING.md) - FormManager Testing Guide
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Overall Architecture Description

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-21
**Author:** Claude Sonnet 4.5
