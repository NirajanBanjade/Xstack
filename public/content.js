// public/content.js
console.log('Content script loaded on:', window.location.hostname);

let lastCopiedContent = '';
let copyCheckInterval;

// Monitor copy events automatically
document.addEventListener('copy', handleCopyEvent);
document.addEventListener('cut', handleCopyEvent);

// Also monitor keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
    setTimeout(() => {
      checkClipboardContent();
    }, 100);
  }
});

async function handleCopyEvent(event) {
  console.log('📋 Copy/Cut event detected');
  
  try {
    let copiedText = '';
    
    // Method 1: From selection
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      copiedText = selection.toString().trim();
      console.log('Got text from selection:', copiedText.substring(0, 30) + '...');
    }
    
    // Method 2: From clipboard event data
    if (!copiedText && event.clipboardData) {
      copiedText = event.clipboardData.getData('text/plain').trim();
      console.log('Got text from clipboard data:', copiedText.substring(0, 30) + '...');
    }
    
    // Method 3: Try reading clipboard after delay
    if (!copiedText) {
      setTimeout(async () => {
        try {
          const clipText = await navigator.clipboard.readText();
          if (clipText && clipText.trim() && clipText !== lastCopiedContent) {
            processNewCopy(clipText.trim());
          }
        } catch (e) {
          console.log('Could not read clipboard');
        }
      }, 150);
      return;
    }
    
    if (copiedText && copiedText !== lastCopiedContent) {
      processNewCopy(copiedText);
    }
    
  } catch (error) {
    console.error('❌ Error in copy event:', error);
  }
}

// Check clipboard content periodically (fallback)
async function checkClipboardContent() {
  try {
    const clipText = await navigator.clipboard.readText();
    if (clipText && clipText.trim() && clipText !== lastCopiedContent) {
      console.log('📋 Detected new clipboard content via check');
      processNewCopy(clipText.trim());
    }
  } catch (error) {
    // Silent fail - clipboard access might be restricted
  }
}

// Process new copied content
function processNewCopy(copiedText) {
  lastCopiedContent = copiedText;
  console.log('🚀 Processing new copy:', copiedText.substring(0, 30) + '...');
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'addToCopyStack',
    content: copiedText,
    source: {
      url: window.location.href,
      title: document.title,
      hostname: window.location.hostname
    }
  }).then(response => {
    if (response?.success) {
      console.log('✅ Successfully added to copy stack');
      showCopyIndicator();
    } else {
      console.log('⚠️ Failed to add to copy stack:', response);
    }
  }).catch(error => {
    console.error('❌ Error sending to background:', error);
  });
}

// Visual indicator that something was copied
function showCopyIndicator() {
  console.log('🎉 Showing copy indicator');
  
  // Remove existing indicator if any
  const existing = document.getElementById('copy-stack-indicator');
  if (existing) {
    existing.remove();
  }
  
  // Create notification element
  const indicator = document.createElement('div');
  indicator.id = 'copy-stack-indicator';
  indicator.innerHTML = '📋 Added to Copy Stack';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(34, 197, 94, 0.95);
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: slideInFromRight 0.3s ease-out;
    pointer-events: none;
  `;
  
  // Add CSS animation
  if (!document.getElementById('copy-stack-styles')) {
    const style = document.createElement('style');
    style.id = 'copy-stack-styles';
    style.textContent = `
      @keyframes slideInFromRight {
        from { 
          transform: translateX(100%); 
          opacity: 0; 
        }
        to { 
          transform: translateX(0); 
          opacity: 1; 
        }
      }
      @keyframes slideOutToRight {
        from { 
          transform: translateX(0); 
          opacity: 1; 
        }
        to { 
          transform: translateX(100%); 
          opacity: 0; 
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(indicator);
  
  // Remove after 2.5 seconds
  setTimeout(() => {
    indicator.style.animation = 'slideOutToRight 0.3s ease-out';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }, 2500);
}

// Start periodic checking as backup (every 2 seconds)
copyCheckInterval = setInterval(checkClipboardContent, 2000);

// Listen for page unload to clean up
window.addEventListener('beforeunload', () => {
  if (copyCheckInterval) {
    clearInterval(copyCheckInterval);
  }
});

console.log('✅ Content script ready with enhanced copy detection');