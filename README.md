# Xstack

Xstack is an experimental clipboard stack extension for Google Chrome. It captures copied text from web pages, stores multiple entries, and displays them in a browser side panel so users can revisit, organize, copy, drag, or paste previously copied content.

The project is built with React, TypeScript, Vite, and the Chrome Extensions Manifest V3 APIs.

> Xstack is currently a prototype intended for local development and testing. It has not been packaged or published in the Chrome Web Store.

## Features

### Automatic text capture

- Detects text copied or cut from regular web pages.
- Supports keyboard shortcuts, page copy events, input and textarea selections, and browser context-menu copying.
- Records the page title, URL, hostname, and capture time when available.
- Shows a temporary confirmation on the page after text is added.

### Clipboard stack

- Places the most recently copied item at the top of the active stack.
- Stores up to 100 items in each stack.
- Saves stack data in `chrome.storage.local`, allowing it to remain available after the side panel or browser is closed.
- Filters immediate duplicate or highly similar capture events to reduce accidental repeated entries.
- Moves an older exact match to the top when it is copied again after the duplicate time window.

### Side-panel interface

- Opens Xstack in Chrome's side panel by clicking the extension toolbar button.
- Displays a preview, source, relative capture time, and character count for each entry.
- Marks the newest item as the latest stack entry.
- Links captured items back to their original web page when a valid URL is available.
- Updates automatically when the extension captures or removes an item.
- Includes an optional transparent panel appearance.

### Stack organization

- Includes a default stack named `Main Stack`.
- Allows users to create additional named stacks.
- Allows switching between stacks.
- Allows non-default stacks to be deleted.
- Allows all items in the current stack to be cleared after confirmation.

### Reusing copied text

- Copies an individual card's text back to the system clipboard.
- Supports dragging a card into compatible text fields or applications.
- Uses the latest stack item for a normal paste action and then removes that item from the stack.
- Allows older individual entries to be removed from the interface.

### Browser integration

- Adds an `Add to Copy Stack` option to the context menu for selected text.
- Provides an extension action context-menu option for enabling or disabling automatic capture.
- Configures `Ctrl+Shift+C` as the default command for opening the extension action.

## Important paste behavior

Xstack treats the active stack like a last-in, first-out clipboard queue. When `Ctrl+V` or the corresponding macOS paste shortcut is used on a supported web page:

1. Xstack writes the newest stack entry to the clipboard.
2. The browser performs the normal paste.
3. Xstack removes that newest entry from the stack.

This is intentionally different from a traditional clipboard-history tool, where pasting normally leaves the history unchanged. Test this behavior with non-sensitive sample text before using the extension in a normal workflow.

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 side-panel support
- Node.js 20.19 or newer
- npm
- Git, if cloning the repository

The instructions below use Google Chrome. Menu names may differ slightly in another Chromium-based browser.

## Install and test on a desktop

### 1. Get the project

Clone the repository and enter its directory:

```bash
git clone <repository-url>
cd csx
```

If the project is already on your computer, open a terminal in the project root instead.

### 2. Install dependencies

```bash
npm install
```

For a clean, lockfile-based installation, you can use:

```bash
npm ci
```

### 3. Create a production build

```bash
npm run build
```

This compiles the TypeScript and React application and creates a `dist` directory. The generated directory contains the side-panel application, extension manifest, background service worker, and content script required by Chrome.

### 4. Load Xstack in Chrome

1. Open Google Chrome.
2. Go to `chrome://extensions`.
3. Enable `Developer mode` using the switch in the upper-right corner.
4. Select `Load unpacked`.
5. Choose the generated `dist` directory, not the repository root.
6. Confirm that `Xstack` appears in the extensions list without errors.
7. Open Chrome's Extensions menu and pin Xstack if you want its toolbar button to remain visible.

### 5. Open the side panel

1. Open a normal website using `http` or `https`.
2. Click the Xstack toolbar button.
3. Confirm that the side panel opens and displays the `Main Stack`.

Chrome does not allow content scripts to run on protected pages such as `chrome://extensions`, the Chrome Web Store, or some internal browser pages. Use a normal website when testing copy detection.

### 6. Run a basic feature test

Use harmless sample text for the first test:

1. Select text on a web page and copy it.
2. Confirm that an on-page notification appears.
3. Confirm that a new card appears at the top of the Xstack side panel.
4. Check that the card shows its source page, capture time, and character count.
5. Click the card's copy button and paste into a temporary text field.
6. Copy two or three different values and confirm that the newest value appears first.
7. Paste normally into a text field and confirm that the newest entry is used and removed from the stack.
8. Drag an older card into a compatible text field and confirm that its text is transferred.
9. Open the stack selector, create a new stack, switch to it, and copy another sample.
10. Return to `Main Stack` and confirm that the stacks retain separate items.
11. Select text on a page, right-click it, and choose `Add to Copy Stack`.
12. Use the clear action and confirm that the current stack becomes empty.

## Development workflow

After changing the source code, rebuild the extension:

```bash
npm run build
```

Then return to `chrome://extensions` and click the reload button on the Xstack extension card. Refresh any web pages that were already open so Chrome can load the updated content script.

The available npm commands are:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the Vite development server for interface development |
| `npm run build` | Type-checks the project and creates the installable `dist` directory |
| `npm run lint` | Runs ESLint across the project |
| `npm run preview` | Serves the production web build locally |

The extension should be tested through Chrome's unpacked-extension workflow. The Vite development server and preview server do not provide the full Chrome extension environment, so APIs such as `chrome.storage`, content scripts, service workers, and the side panel are not fully represented there.

## Project structure

```text
.
├── public/
│   ├── background.js       # Manifest V3 service worker and stack operations
│   ├── content.js          # Web-page copy and paste integration
│   └── manifest.json       # Chrome extension configuration and permissions
├── src/
│   ├── Cards/              # Individual copied-item card
│   ├── Cards_holder/       # Side-panel layout and stack controls
│   ├── Copy_manager/       # Stack state, duplicate checks, and persistence
│   ├── Types.tsx           # Shared TypeScript interfaces
│   └── main.tsx            # React entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## How the extension works

1. `content.js` listens for copy, cut, keyboard, focus, and visibility events on supported web pages.
2. Captured text and source information are sent to the background service worker.
3. `background.js` checks for duplicates and writes the active stack to `chrome.storage.local`.
4. The React side panel listens for storage changes and refreshes its cards.
5. Copy, paste, delete, clear, and stack-management actions update the same stored data.

## Permissions

Xstack requests the following Chrome permissions:

| Permission | Reason |
| --- | --- |
| `storage` | Persists stacks and copied items locally |
| `sidePanel` | Displays the extension interface in Chrome's side panel |
| `clipboardRead` | Detects clipboard text when browser access is allowed |
| `clipboardWrite` | Places a selected or latest stack entry on the clipboard |
| `activeTab` | Reads information about the current tab during user interaction |
| `scripting` | Injects or runs extension logic in supported tabs |
| `tabs` | Reads tab URLs and titles for source information and synchronization |
| `contextMenus` | Adds selection and extension action menu commands |

The host permissions cover HTTP and HTTPS pages so copy detection can work across regular websites. Stack data is stored locally in the browser profile by the current implementation.

## Known limitations

- This is an early prototype and has not been prepared for production distribution.
- Automatic capture depends on browser clipboard permissions and page security rules.
- Chrome-protected pages and some browser-managed documents do not permit content-script access.
- Some websites may block or override clipboard and drag-and-drop behavior.
- The extension currently focuses on plain text; images, files, and rich clipboard formats are not supported.
- Paste removes the latest item from the active stack.
- The newest item is protected from individual deletion in the side-panel card interface, although it can be consumed by pasting or removed by clearing the stack.
- Stack data is local to the current browser profile and is not synchronized through an account or external service.
- The configured shortcut can conflict with browser, operating-system, or website shortcuts.
- The user interface contains prototype controls and behavior that may change.

## Troubleshooting

### The extension does not appear after building

Confirm that `npm run build` completed successfully and that Chrome was given the `dist` directory when `Load unpacked` was selected.

### Copied text is not captured

- Test on a normal HTTP or HTTPS page.
- Refresh the page after installing or reloading the extension.
- Confirm that the extension is enabled on `chrome://extensions`.
- Check whether Xstack was disabled through its extension action context menu.
- Try copying selected plain text with the keyboard before testing a site's custom copy controls.

### The side panel shows old data

Close and reopen the side panel. If the issue remains, reload Xstack on `chrome://extensions` and refresh the test page.

### Chrome reports an extension error

Open `chrome://extensions`, find Xstack, and select the available error or service-worker inspection link. The browser console for the test page can also show content-script messages.

### Changes are not visible

Run `npm run build`, reload the extension on `chrome://extensions`, and refresh all pages involved in the test. Changes to the background service worker or content script are not applied only by refreshing the side panel.

## Privacy and security notes

Xstack captures copied plain text on supported web pages while automatic capture is active. Copied content can include confidential information, authentication codes, personal data, or other sensitive text.

Use the prototype only with data you are comfortable storing in the browser's local extension storage. Clear the active stack when testing is complete, and remove the extension from Chrome if it is no longer needed.

## Project status

Xstack is under active prototype development. Contributions, issue reports, and testing feedback should clearly describe the Chrome version, operating system, page being tested, and steps needed to reproduce the behavior.
