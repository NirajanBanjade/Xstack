// Enhanced content.js - Improved clipboard detection
console.log('Enhanced Copy Stack content script loaded on:', window.location.hostname);

let lastCopiedContent = '';
let isExtensionActive = true;
let clipboardCheckInterval;

// Check if extension is active
async function checkExtensionStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getExtensionStatus' });
    isExtensionActive = response?.active || false;
    console.log('Extension status:', isExtensionActive ? 'Active' : 'Inactive');
  } catch (error) {
    isExtensionActive = false;
  }
}

// Initialize
checkExtensionStatus();

// === MULTIPLE COPY DETECTION METHODS ===

// Method 1: Direct copy/cut event listeners
document.addEventListener('copy', handleCopyEvent, true);
document.addEventListener('cut', handleCopyEvent, true);

// Method 2: Keyboard shortcut detection
document.addEventListener('keydown', async (e) => {
  // Handle copy/cut detection
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
    setTimeout(checkClipboardContent, 150); // Check after copy operation
  }
  
  // Handle Ctrl+V - paste latest item and remove it from stack
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    await handleCtrlV(e);
  }
});

// Method 3: Context menu detection
document.addEventListener('contextmenu', () => {
  setTimeout(checkClipboardContent, 500); // Wait for potential context menu copy
});

// Method 4: Focus change detection (for when user switches back to page after copying)
window.addEventListener('focus', () => {
  setTimeout(checkClipboardContent, 100);
});

// Method 5: Visibility change detection
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    setTimeout(checkClipboardContent, 100);
  }
});

// === COPY EVENT HANDLER ===
async function handleCopyEvent(event) {
  if (!isExtensionActive) return;
  
  console.log('📋 Copy/Cut event detected');
  
  let copiedText = '';
  
  try {
    // Try to get text from selection first
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      copiedText = selection.toString().trim();
    }
    
    // Fallback to clipboard event data
    if (!copiedText && event.clipboardData) {
      const clipData = event.clipboardData.getData('text/plain');
      if (clipData && clipData.trim()) {
        copiedText = clipData.trim();
      }
    }
    
    // Fallback to input/textarea selection
    if (!copiedText) {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        if (start !== end) {
          copiedText = activeElement.value.substring(start, end).trim();
        }
      }
    }
    
    if (copiedText && copiedText !== lastCopiedContent) {
      processNewCopy(copiedText);
    } else {
      // Final fallback: check clipboard after a delay
      setTimeout(checkClipboardContent, 200);
    }
    
  } catch (error) {
    console.log('Copy event processing failed:', error);
    setTimeout(checkClipboardContent, 200);
  }
}

// === ENHANCED CLIPBOARD CHECKING ===
async function checkClipboardContent() {
  if (!isExtensionActive) return;
  
  try {
    let clipText = '';
    
    // Primary method: Clipboard API
    try {
      clipText = await navigator.clipboard.readText();
    } catch (clipError) {
      console.log('Clipboard API failed, trying fallback...');
      
      // Fallback method: Create temporary textarea and paste
      try {
        const textarea = document.createElement('textarea');
        textarea.style.cssText = `
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -1 !important;
        `;
        
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        if (document.execCommand('paste')) {
          clipText = textarea.value;
        }
        
        document.body.removeChild(textarea);
      } catch (pasteError) {
        console.log('Paste fallback also failed');
      }
    }
    
    if (clipText && clipText.trim() && clipText.trim() !== lastCopiedContent) {
      const trimmedText = clipText.trim();
      
      // Skip very short or common content
      if (trimmedText.length >= 3 && 
          !trimmedText.match(/^[a-zA-Z]$/) &&
          !trimmedText.match(/^\d+$/) &&
          !trimmedText.match(/^[!@#$%^&*(),.?":{}|<>]+$/)) {
        
        console.log('📋 New clipboard content detected via polling');
        processNewCopy(trimmedText);
      }
    }
  } catch (error) {
    // Silent fail - clipboard access restrictions are normal
  }
}

// === PROCESS NEW COPY ===
function processNewCopy(copiedText) {
  if (!copiedText || !copiedText.trim() || !isExtensionActive) return;
  
  const trimmedText = copiedText.trim();
  
  // Prevent duplicate processing
  if (trimmedText === lastCopiedContent) {
    return;
  }
  
  lastCopiedContent = trimmedText;
  
  console.log('🚀 Processing new copy:', trimmedText.substring(0, 50) + '...');
  
  // Get source info
  const sourceInfo = {
    url: window.location.href,
    title: document.title || 'Untitled',
    hostname: window.location.hostname,
    timestamp: Date.now()
  };
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'addToCopyStack',
    content: trimmedText,
    source: sourceInfo,
    timestamp: Date.now(),
    method: 'auto-detect'
  }).then(response => {
    if (response?.success) {
      console.log('✅ Successfully added to copy stack');
      showCopyIndicator(trimmedText);
    } else {
      console.log('⚠️ Failed to add to copy stack:', response?.error || 'Unknown error');
    }
  }).catch(error => {
    console.error('❌ Error sending to background:', error);
  });
}

// === HANDLE CTRL+V - PASTE LATEST AND REMOVE ===
async function handleCtrlV(e) {
  if (!isExtensionActive) return;
  
  try {
    // Get the latest item from the stack
    const response = await chrome.runtime.sendMessage({ action: 'getLatestItem' });
    
    if (response?.success && response.item) {
      const latestContent = response.item.content;
      
      // Set clipboard to latest content
      try {
        await navigator.clipboard.writeText(latestContent);
        console.log('📋 Set clipboard to latest item:', latestContent.substring(0, 50) + '...');
        
        // Remove the item from the stack since we're "using" it
        const removeResponse = await chrome.runtime.sendMessage({ action: 'removeLatestItem' });
        
        if (removeResponse?.success) {
          console.log('✅ Removed latest item from stack after paste');
          showPasteIndicator(latestContent);
        }
        
        // Allow the normal paste operation to continue
        // The browser will paste our latest content instead of whatever was in clipboard
        
      } catch (clipboardError) {
        console.log('Direct clipboard write failed, trying fallback...');
        
        // Fallback: Create textarea and copy content
        const textarea = document.createElement('textarea');
        textarea.value = latestContent;
        textarea.style.cssText = `
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          opacity: 0 !important;
        `;
        
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        // Remove from stack
        await chrome.runtime.sendMessage({ action: 'removeLatestItem' });
        showPasteIndicator(latestContent);
      }
      
    } else {
      console.log('No items in copy stack for Ctrl+V');
    }
    
  } catch (error) {
    console.error('❌ Error handling Ctrl+V:', error);
  }
}

// === PASTE INDICATOR ===
function showPasteIndicator(pastedText) {
  // Remove existing indicator
  const existing = document.getElementById('copy-stack-paste-indicator');
  if (existing) existing.remove();
  
  const indicator = document.createElement('div');
  indicator.id = 'copy-stack-paste-indicator';
  
  const preview = pastedText.length > 30 ? pastedText.substring(0, 30) + '...' : pastedText;
  
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">📤</span>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Pasted from Copy Stack</div>
        <div style="font-size: 11px; opacity: 0.8; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${preview}</div>
      </div>
    </div>
  `;
  
  indicator.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95)) !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 12px !important;
    font-size: 12px !important;
    z-index: 999999 !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    pointer-events: none !important;
    backdrop-filter: blur(10px) !important;
    max-width: 280px !important;
    animation: copySlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  `;
  
  document.body.appendChild(indicator);
  
  // Slide out animation
  setTimeout(() => {
    indicator.style.animation = 'copySlideOut 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 400);
  }, 2000);
}
function showCopyIndicator(copiedText) {
  // Remove existing indicator
  const existing = document.getElementById('copy-stack-indicator');
  if (existing) existing.remove();
  
  const indicator = document.createElement('div');
  indicator.id = 'copy-stack-indicator';
  
  const preview = copiedText.length > 30 ? copiedText.substring(0, 30) + '...' : copiedText;
  
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">📋</span>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Added to Copy Stack</div>
        <div style="font-size: 11px; opacity: 0.8; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${preview}</div>
      </div>
    </div>
  `;
  
  indicator.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(16, 185, 129, 0.95)) !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 12px !important;
    font-size: 12px !important;
    z-index: 999999 !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    pointer-events: none !important;
    backdrop-filter: blur(10px) !important;
    max-width: 280px !important;
    animation: copySlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  `;
  
  // Add animation styles if not exists
  if (!document.getElementById('copy-stack-styles')) {
    const style = document.createElement('style');
    style.id = 'copy-stack-styles';
    style.textContent = `
      @keyframes copySlideIn {
        from { transform: translateX(100%) scale(0.8); opacity: 0; }
        50% { transform: translateX(-10px) scale(1.05); opacity: 0.9; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes copySlideOut {
        from { transform: translateX(0) scale(1); opacity: 1; }
        to { transform: translateX(100%) scale(0.8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(indicator);
  
  // Slide out animation
  setTimeout(() => {
    indicator.style.animation = 'copySlideOut 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 400);
  }, 3000);
}

// === PERIODIC CLIPBOARD MONITORING ===
function startClipboardMonitoring() {
  // Initial fast checking (every 1 second for first 30 seconds)
  let fastCheckCount = 0;
  const maxFastChecks = 30;
  
  clipboardCheckInterval = setInterval(() => {
    if (isExtensionActive) {
      checkClipboardContent();
    }
    
    fastCheckCount++;
    if (fastCheckCount >= maxFastChecks) {
      // Switch to slower interval
      clearInterval(clipboardCheckInterval);
      clipboardCheckInterval = setInterval(() => {
        if (isExtensionActive) {
          checkClipboardContent();
        }
      }, 3000); // Every 3 seconds after initial period
    }
  }, 1000);
}

// Start monitoring
startClipboardMonitoring();

// === MESSAGE HANDLERS ===
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extensionStatusChanged') {
    isExtensionActive = message.active;
    console.log('Extension status changed:', isExtensionActive ? 'Active' : 'Inactive');
  }
  
  if (message.action === 'forceClipboardCheck') {
    checkClipboardContent();
  }
});

// === CLEANUP ===
window.addEventListener('beforeunload', () => {
  if (clipboardCheckInterval) {
    clearInterval(clipboardCheckInterval);
  }
});

// Performance optimization: adjust monitoring based on page visibility
document.addEventListener('visibilitychange', () => {
  if (clipboardCheckInterval) {
    clearInterval(clipboardCheckInterval);
  }
  
  if (document.hidden) {
    // Page hidden: check every 5 seconds
    clipboardCheckInterval = setInterval(() => {
      if (isExtensionActive) checkClipboardContent();
    }, 5000);
  } else {
    // Page visible: resume normal monitoring
    startClipboardMonitoring();
  }
});

console.log('✅ Enhanced content script ready - automatic clipboard detection enabled!');

