// public/background.js
console.log('Background script starting...');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('✓ Copy Stack Extension installed');
  
  // Create context menu
  try {
    chrome.contextMenus.create({
      id: 'addToCopyStack',
      title: 'Add to Copy Stack',
      contexts: ['selection']
    });
    console.log('✓ Context menu created');
  } catch (error) {
    console.log('Context menu creation failed:', error);
  }
});

// Handle context menu clicks
chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToCopyStack' && info.selectionText) {
    console.log('Context menu clicked, adding:', info.selectionText.substring(0, 30));
    await addToCopyStack(info.selectionText, {
      url: tab?.url || '',
      title: tab?.title || 'Unknown',
      hostname: tab?.url ? new URL(tab.url).hostname : 'Unknown'
    });
  }
});

// Function to add item to copy stack
async function addToCopyStack(content, source = {}) {
  console.log('🔄 Adding to copy stack:', content.substring(0, 30) + '...');
  
  try {
    // Get existing data
    const result = await chrome.storage.local.get('copyStacks');
    let data = result.copyStacks;
    
    if (!data) {
      console.log('📋 Creating new copy stack');
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
        console.log('✅ Successfully added to copy stack!');
        
        return true;
      } else {
        console.log('⚠️ Content already exists in stack');
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error adding to copy stack:', error);
    return false;
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.action);
  
  if (message.action === 'addToCopyStack') {
    addToCopyStack(message.content, message.source)
      .then((success) => {
        console.log('📋 Add to copy stack result:', success);
        sendResponse({ success });
      })
      .catch(error => {
        console.error('❌ Add to copy stack error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open
  }
  
  if (message.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => sendResponse({ tab }))
      .catch(error => sendResponse({ tab: null, error: error.message }));
    return true;
  }
  
  if (message.action === 'copyToClipboard') {
    console.log('🔄 Copying to clipboard:', message.text.substring(0, 30) + '...');
    
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.id) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text) => {
              return navigator.clipboard.writeText(text);
            },
            args: [message.text]
          });
          console.log('✅ Copy successful');
          sendResponse({ success: true });
        } catch (error) {
          console.error('❌ Copy failed:', error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        console.error('❌ No active tab');
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true;
  }
});

console.log('✅ Background script loaded successfully');