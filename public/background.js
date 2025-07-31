console.log('Enhanced Copy Stack background script starting...');

let extensionActive = true;

// === CONTEXT MENU SETUP ===
chrome.runtime.onInstalled.addListener(() => {
  console.log('✓ Copy Stack Extension installed');

  try {
    chrome.contextMenus.create({
      id: 'addToCopyStack',
      title: 'Add to Copy Stack',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'toggleExtension',
      title: 'Toggle Copy Stack',
      contexts: ['action']
    });

    console.log('✓ Context menus created');
  } catch (error) {
    console.log('Context menu creation failed:', error);
  }
});

// === MESSAGE HANDLER - THIS WAS MISSING! ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message.action);

  if (message.action === 'addToCopyStack') {
    addToCopyStack(message.content, message.source || {})
      .then(success => {
        console.log('✅ AddToCopyStack result:', success);
        sendResponse({ success: success });
      })
      .catch(error => {
        console.error('❌ AddToCopyStack error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.action === 'getExtensionStatus') {
    sendResponse({ active: extensionActive });
    return true;
  }

  if (message.action === 'getLatestItem') {
    getLatestItem()
      .then(item => {
        sendResponse({ success: true, item: item });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'removeLatestItem') {
    removeLatestItem()
      .then(success => {
        sendResponse({ success: success });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.action === 'copyToClipboard') {
    // Fallback clipboard copy method
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (text) => {
              navigator.clipboard.writeText(text).catch(() => {
                // Fallback method
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
              });
            },
            args: [message.text]
          });
        }
      });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// === CONTEXT MENU HANDLER ===
chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToCopyStack' && info.selectionText) {
    console.log('Context menu clicked, adding:', info.selectionText.substring(0, 30));
    await addToCopyStack(info.selectionText, {
      url: tab?.url || '',
      title: tab?.title || 'Unknown',
      hostname: tab?.url ? new URL(tab.url).hostname : 'Unknown'
    });
  }

  if (info.menuItemId === 'toggleExtension') {
    extensionActive = !extensionActive;
    console.log('Extension toggled:', extensionActive ? 'Active' : 'Inactive');

    // Notify all tabs about status change
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'extensionStatusChanged',
          active: extensionActive
        }).catch(() => {});
      }
    });
  }
});

// === ADD TO COPY STACK ===
async function addToCopyStack(content, source = {}, options = {}) {
  if (!extensionActive && !options.force) {
    console.log('🚫 Extension inactive, skipping copy');
    return false;
  }

  const trimmedContent = content.trim();
  console.log('🔄 Adding to copy stack:', trimmedContent.substring(0, 50) + '...');

  try {
    const result = await chrome.storage.local.get('copyStacks');
    let data = result.copyStacks;

    // Initialize if no data exists
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
      const now = Date.now();
      const recentTimeWindow = 5 * 1000; // Reduced to 5 seconds for more responsive detection

      // Check for exact duplicates
      const exactDuplicate = currentStack.items.find(item =>
        item.content.trim() === trimmedContent
      );

      if (exactDuplicate) {
        if (now - exactDuplicate.timestamp < recentTimeWindow) {
          console.log('⚠️ Recent duplicate content, skipping');
          return false;
        } else {
          // Update existing item
          exactDuplicate.timestamp = now;
          exactDuplicate.source = enhanceSourceInfo(source);
          currentStack.items = currentStack.items.filter(item => item.id !== exactDuplicate.id);
          currentStack.items.unshift(exactDuplicate);
          console.log('♻️ Updated existing item timestamp');
        }
      } else {
        // Check similarity only for recent items (last 10 items)
        const recentItems = currentStack.items.slice(0, 10);
        const similarity = findMostSimilar(trimmedContent, recentItems);
        
        if (similarity.score > 0.95 && (now - similarity.item?.timestamp) < recentTimeWindow) {
          console.log('⚠️ Very similar content found recently, skipping');
          return false;
        }

        // Create new item
        const newItem = {
          id: generateEnhancedId(),
          content: trimmedContent,
          timestamp: now,
          source: enhanceSourceInfo(source),
          wordCount: trimmedContent.split(/\s+/).length,
          charCount: trimmedContent.length
        };

        currentStack.items.unshift(newItem);
        console.log('✅ Added new item to stack');
      }

      currentStack.lastModified = now;

      // Maintain stack size limit
      if (currentStack.items.length > 100) {
        currentStack.items = currentStack.items.slice(0, 100);
      }

      // Save to storage
      stacks.set(data.currentStackId, currentStack);
      data.stacks = Array.from(stacks.entries());

      await chrome.storage.local.set({ copyStacks: data });
      console.log('💾 Successfully saved to storage');
      
      // Notify popup if it's open
      try {
        chrome.runtime.sendMessage({ action: 'stackUpdated' });
      } catch (e) {
        // Popup might not be open, that's fine
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Error adding to copy stack:', error);
    return false;
  }
}

// === SIMILARITY UTILITIES ===
function calculateSimilarity(a, b) {
  if (!a || !b) return 0;
  
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(word => word.length > 2));
  const bWords = new Set(b.toLowerCase().split(/\s+/).filter(word => word.length > 2));
  
  if (aWords.size === 0 || bWords.size === 0) return 0;
  
  const intersection = [...aWords].filter(word => bWords.has(word));
  const union = new Set([...aWords, ...bWords]);
  
  return intersection.length / union.size;
}

function findMostSimilar(content, items) {
  let maxSimilarity = 0;
  let mostSimilarItem = null;

  for (const item of items) {
    const score = calculateSimilarity(content, item.content);
    if (score > maxSimilarity) {
      maxSimilarity = score;
      mostSimilarItem = item;
    }
  }

  return {
    score: maxSimilarity,
    item: mostSimilarItem
  };
}

function generateEnhancedId() {
  return Date.now().toString() + '-' + Math.random().toString(36).slice(2, 10);
}

function enhanceSourceInfo(source) {
  return {
    url: source.url || '',
    title: source.title || 'Manual Copy',
    hostname: source.hostname || 'localhost'
  };
}

// === PERIODIC CLIPBOARD MONITORING ===
// This is an additional safety net to catch copies that might be missed
let lastClipboardContent = '';

async function monitorClipboard() {
  if (!extensionActive) return;
  
  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      // Execute script to check clipboard in active tab
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: async () => {
          try {
            const clipText = await navigator.clipboard.readText();
            if (clipText && clipText.trim()) {
              chrome.runtime.sendMessage({
                action: 'checkClipboardContent',
                content: clipText.trim(),
                source: {
                  url: window.location.href,
                  title: document.title,
                  hostname: window.location.hostname
                }
              });
            }
          } catch (error) {
            // Clipboard access denied, that's okay
          }
        }
      }).catch(() => {
        // Tab might not be accessible, that's okay
      });
    }
  } catch (error) {
    // Silent fail
  }
}

// Handle clipboard content check
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkClipboardContent') {
    if (message.content !== lastClipboardContent) {
      lastClipboardContent = message.content;
      addToCopyStack(message.content, message.source);
    }
  }
});

// Start periodic monitoring (every 2 seconds)
setInterval(monitorClipboard, 2000);

// === GET LATEST ITEM ===
async function getLatestItem() {
  try {
    const result = await chrome.storage.local.get('copyStacks');
    const data = result.copyStacks;
    
    if (!data) return null;
    
    const stacks = new Map(data.stacks);
    const currentStack = stacks.get(data.currentStackId) || stacks.get('default');
    
    if (currentStack && currentStack.items.length > 0) {
      return currentStack.items[0]; // Return the most recent item (first in array)
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting latest item:', error);
    return null;
  }
}

// === REMOVE LATEST ITEM ===
async function removeLatestItem() {
  try {
    const result = await chrome.storage.local.get('copyStacks');
    let data = result.copyStacks;
    
    if (!data) return false;
    
    const stacks = new Map(data.stacks);
    const currentStack = stacks.get(data.currentStackId) || stacks.get('default');
    
    if (currentStack && currentStack.items.length > 0) {
      // Remove the first item (most recent)
      currentStack.items.shift();
      currentStack.lastModified = Date.now();
      
      // Save back to storage
      stacks.set(data.currentStackId, currentStack);
      data.stacks = Array.from(stacks.entries());
      
      await chrome.storage.local.set({ copyStacks: data });
      console.log('✅ Removed latest item from stack');
      
      // Notify popup if it's open
      try {
        chrome.runtime.sendMessage({ action: 'stackUpdated' });
      } catch (e) {
        // Popup might not be open, that's fine
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error removing latest item:', error);
    return false;
  }
}

// console.log('Enhanced Copy Stack background script starting...');

// let extensionActive = true;

// // === CONTEXT MENU SETUP ===
// chrome.runtime.onInstalled.addListener(() => {
//   console.log('✓ Copy Stack Extension installed');

//   try {
//     chrome.contextMenus.create({
//       id: 'addToCopyStack',
//       title: 'Add to Copy Stack',
//       contexts: ['selection']
//     });

//     chrome.contextMenus.create({
//       id: 'toggleExtension',
//       title: 'Toggle Copy Stack',
//       contexts: ['action']
//     });

//     console.log('✓ Context menus created');
//   } catch (error) {
//     console.log('Context menu creation failed:', error);
//   }
// });

// // === MESSAGE HANDLER - THIS WAS MISSING! ===
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   console.log('📨 Background received message:', message.action);

//   if (message.action === 'addToCopyStack') {
//     addToCopyStack(message.content, message.source || {})
//       .then(success => {
//         console.log('✅ AddToCopyStack result:', success);
//         sendResponse({ success: success });
//       })
//       .catch(error => {
//         console.error('❌ AddToCopyStack error:', error);
//         sendResponse({ success: false, error: error.message });
//       });
//     return true; // Keep message channel open for async response
//   }

//   if (message.action === 'getExtensionStatus') {
//     sendResponse({ active: extensionActive });
//     return true;
//   }

//   if (message.action === 'copyToClipboard') {
//     // Fallback clipboard copy method
//     try {
//       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         if (tabs[0]?.id) {
//           chrome.scripting.executeScript({
//             target: { tabId: tabs[0].id },
//             func: (text) => {
//               navigator.clipboard.writeText(text).catch(() => {
//                 // Fallback method
//                 const textarea = document.createElement('textarea');
//                 textarea.value = text;
//                 document.body.appendChild(textarea);
//                 textarea.select();
//                 document.execCommand('copy');
//                 document.body.removeChild(textarea);
//               });
//             },
//             args: [message.text]
//           });
//         }
//       });
//       sendResponse({ success: true });
//     } catch (error) {
//       sendResponse({ success: false, error: error.message });
//     }
//     return true;
//   }
// });

// // === CONTEXT MENU HANDLER ===
// chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
//   if (info.menuItemId === 'addToCopyStack' && info.selectionText) {
//     console.log('Context menu clicked, adding:', info.selectionText.substring(0, 30));
//     await addToCopyStack(info.selectionText, {
//       url: tab?.url || '',
//       title: tab?.title || 'Unknown',
//       hostname: tab?.url ? new URL(tab.url).hostname : 'Unknown'
//     });
//   }

//   if (info.menuItemId === 'toggleExtension') {
//     extensionActive = !extensionActive;
//     console.log('Extension toggled:', extensionActive ? 'Active' : 'Inactive');

//     // Notify all tabs about status change
//     const tabs = await chrome.tabs.query({});
//     tabs.forEach(tab => {
//       if (tab.id) {
//         chrome.tabs.sendMessage(tab.id, {
//           action: 'extensionStatusChanged',
//           active: extensionActive
//         }).catch(() => {});
//       }
//     });
//   }
// });

// // === ADD TO COPY STACK ===
// async function addToCopyStack(content, source = {}, options = {}) {
//   if (!extensionActive && !options.force) {
//     console.log('🚫 Extension inactive, skipping copy');
//     return false;
//   }

//   const trimmedContent = content.trim();
//   console.log('🔄 Adding to copy stack:', trimmedContent.substring(0, 50) + '...');

//   try {
//     const result = await chrome.storage.local.get('copyStacks');
//     let data = result.copyStacks;

//     // Initialize if no data exists
//     if (!data) {
//       console.log('📋 Creating new copy stack');
//       data = {
//         stacks: [['default', {
//           id: 'default',
//           name: 'Main Stack',
//           items: [],
//           created: Date.now(),
//           lastModified: Date.now()
//         }]],
//         currentStackId: 'default'
//       };
//     }

//     const stacks = new Map(data.stacks);
//     const currentStack = stacks.get(data.currentStackId) || stacks.get('default');

//     if (currentStack) {
//       const now = Date.now();
//       const recentTimeWindow = 5 * 1000; // Reduced to 5 seconds for more responsive detection

//       // Check for exact duplicates
//       const exactDuplicate = currentStack.items.find(item =>
//         item.content.trim() === trimmedContent
//       );

//       if (exactDuplicate) {
//         if (now - exactDuplicate.timestamp < recentTimeWindow) {
//           console.log('⚠️ Recent duplicate content, skipping');
//           return false;
//         } else {
//           // Update existing item
//           exactDuplicate.timestamp = now;
//           exactDuplicate.source = enhanceSourceInfo(source);
//           currentStack.items = currentStack.items.filter(item => item.id !== exactDuplicate.id);
//           currentStack.items.unshift(exactDuplicate);
//           console.log('♻️ Updated existing item timestamp');
//         }
//       } else {
//         // Check similarity only for recent items (last 10 items)
//         const recentItems = currentStack.items.slice(0, 10);
//         const similarity = findMostSimilar(trimmedContent, recentItems);
        
//         if (similarity.score > 0.95 && (now - similarity.item?.timestamp) < recentTimeWindow) {
//           console.log('⚠️ Very similar content found recently, skipping');
//           return false;
//         }

//         // Create new item
//         const newItem = {
//           id: generateEnhancedId(),
//           content: trimmedContent,
//           timestamp: now,
//           source: enhanceSourceInfo(source),
//           wordCount: trimmedContent.split(/\s+/).length,
//           charCount: trimmedContent.length
//         };

//         currentStack.items.unshift(newItem);
//         console.log('✅ Added new item to stack');
//       }

//       currentStack.lastModified = now;

//       // Maintain stack size limit
//       if (currentStack.items.length > 100) {
//         currentStack.items = currentStack.items.slice(0, 100);
//       }

//       // Save to storage
//       stacks.set(data.currentStackId, currentStack);
//       data.stacks = Array.from(stacks.entries());

//       await chrome.storage.local.set({ copyStacks: data });
//       console.log('💾 Successfully saved to storage');
      
//       // Notify popup if it's open
//       try {
//         chrome.runtime.sendMessage({ action: 'stackUpdated' });
//       } catch (e) {
//         // Popup might not be open, that's fine
//       }
      
//       return true;
//     }
//   } catch (error) {
//     console.error('❌ Error adding to copy stack:', error);
//     return false;
//   }
// }

// // === SIMILARITY UTILITIES ===
// function calculateSimilarity(a, b) {
//   if (!a || !b) return 0;
  
//   const aWords = new Set(a.toLowerCase().split(/\s+/).filter(word => word.length > 2));
//   const bWords = new Set(b.toLowerCase().split(/\s+/).filter(word => word.length > 2));
  
//   if (aWords.size === 0 || bWords.size === 0) return 0;
  
//   const intersection = [...aWords].filter(word => bWords.has(word));
//   const union = new Set([...aWords, ...bWords]);
  
//   return intersection.length / union.size;
// }

// function findMostSimilar(content, items) {
//   let maxSimilarity = 0;
//   let mostSimilarItem = null;

//   for (const item of items) {
//     const score = calculateSimilarity(content, item.content);
//     if (score > maxSimilarity) {
//       maxSimilarity = score;
//       mostSimilarItem = item;
//     }
//   }

//   return {
//     score: maxSimilarity,
//     item: mostSimilarItem
//   };
// }

// function generateEnhancedId() {
//   return Date.now().toString() + '-' + Math.random().toString(36).slice(2, 10);
// }

// function enhanceSourceInfo(source) {
//   return {
//     url: source.url || '',
//     title: source.title || 'Manual Copy',
//     hostname: source.hostname || 'localhost'
//   };
// }

// // === PERIODIC CLIPBOARD MONITORING ===
// // This is an additional safety net to catch copies that might be missed
// let lastClipboardContent = '';

// async function monitorClipboard() {
//   if (!extensionActive) return;
  
//   try {
//     // Get active tab
//     const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (tabs[0]?.id) {
//       // Execute script to check clipboard in active tab
//       chrome.scripting.executeScript({
//         target: { tabId: tabs[0].id },
//         func: async () => {
//           try {
//             const clipText = await navigator.clipboard.readText();
//             if (clipText && clipText.trim()) {
//               chrome.runtime.sendMessage({
//                 action: 'checkClipboardContent',
//                 content: clipText.trim(),
//                 source: {
//                   url: window.location.href,
//                   title: document.title,
//                   hostname: window.location.hostname
//                 }
//               });
//             }
//           } catch (error) {
//             // Clipboard access denied, that's okay
//           }
//         }
//       }).catch(() => {
//         // Tab might not be accessible, that's okay
//       });
//     }
//   } catch (error) {
//     // Silent fail
//   }
// }

// // Handle clipboard content check
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === 'checkClipboardContent') {
//     if (message.content !== lastClipboardContent) {
//       lastClipboardContent = message.content;
//       addToCopyStack(message.content, message.source);
//     }
//   }
// });

// // Start periodic monitoring (every 2 seconds)
// setInterval(monitorClipboard, 2000);

// console.log('✅ Enhanced background script ready with message handling!');