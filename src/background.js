// background.js - Enhanced clipboard handling
let lastClipboardContent = '';

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Copy Stack Extension installed');
  
  // Set up context menu for right-click copy
  chrome.contextMenus.create({
    id: 'addToCopyStack',
    title: 'Add to Copy Stack',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToCopyStack' && info.selectionText) {
    await addToCopyStack(info.selectionText, {
      url: tab?.url || '',
      title: tab?.title || 'Unknown',
      hostname: tab?.url ? new URL(tab.url).hostname : 'Unknown'
    });
  }
});

// Function to get current tab info
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch (error) {
    console.error('Error getting current tab:', error);
    return null;
  }
}

// Function to add item to copy stack
async function addToCopyStack(content, source = {}) {
  try {
    // Get existing data
    const result = await chrome.storage.local.get('copyStacks');
    let data = result.copyStacks;
    
    if (!data) {
      data = {
        stacks: [['default', {
          id: 'default',
          name: 'Main Stack',
          items: [],
          created: Date.now(),
          lastModified: Date.now()
        }]],
        currentStackId: 'default'
      };
    }
    
    const stacks = new Map(data.stacks);
    const currentStack = stacks.get(data.currentStackId) || stacks.get('default');
    
    if (currentStack) {
      // Check for duplicates
      const exists = currentStack.items.some(item => item.content.trim() === content.trim());
      
      if (!exists) {
        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substr(2),
          content: content.trim(),
          timestamp: Date.now(),
          source: {
            url: source.url || '',
            title: source.title || 'Unknown',
            hostname: source.hostname || 'Unknown'
          }
        };
        
        currentStack.items.unshift(newItem);
        currentStack.lastModified = Date.now();
        
        // Limit to 100 items
        if (currentStack.items.length > 100) {
          currentStack.items = currentStack.items.slice(0, 100);
        }
        
        stacks.set(data.currentStackId, currentStack);
        data.stacks = Array.from(stacks.entries());
        
        await chrome.storage.local.set({ copyStacks: data });
        console.log('Added to copy stack:', content.substring(0, 50) + '...');
        
        // Show notification (optional)
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'assets/icon48.png',
          title: 'Added to Copy Stack',
          message: `"${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`
        });
      }
    }
  } catch (error) {
    console.error('Error adding to copy stack:', error);
  }
}

// Enhanced copy function for extension use
async function copyToClipboard(text, tabId) {
  try {
    // Method 1: Use scripting API to copy in active tab
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (textToCopy) => {
        return navigator.clipboard.writeText(textToCopy);
      },
      args: [text]
    });
    return true;
  } catch (error) {
    console.error('Copy via scripting failed:', error);
    return false;
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addToCopyStack') {
    addToCopyStack(message.content, message.source)
      .then(() => {
        console.log('✓ Successfully added to copy stack');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('✗ Failed to add to copy stack:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'getCurrentTab') {
    getCurrentTab()
      .then(tab => sendResponse({ tab }))
      .catch(error => sendResponse({ tab: null, error: error.message }));
    return true;
  }
  
  if (message.action === 'copyToClipboard') {
    getCurrentTab().then(async (tab) => {
      if (tab?.id) {
        const success = await copyToClipboard(message.text, tab.id);
        sendResponse({ success });
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true;
  }
  
  if (message.action === 'openExtension') {
    // Open the extension popup (if possible)
    chrome.action.openPopup?.().catch(() => {
      console.log('Could not open popup programmatically');
    });
    sendResponse({ success: true });
  }
});

// Add notification permission to manifest if needed
if (chrome.notifications) {
  // Notifications are available
}