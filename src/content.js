// content.js - Enhanced copy detection
let lastCopiedContent = '';

// Monitor copy events automatically
document.addEventListener('copy', async (event) => {
  try {
    // Get the copied text
    let copiedText = '';
    
    // Method 1: From selection
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      copiedText = selection.toString().trim();
    }
    
    // Method 2: From clipboard event (if available)
    if (!copiedText && event.clipboardData) {
      copiedText = event.clipboardData.getData('text/plain').trim();
    }
    
    // Method 3: Try reading clipboard after a short delay
    if (!copiedText) {
      setTimeout(async () => {
        try {
          copiedText = await navigator.clipboard.readText();
          if (copiedText.trim() && copiedText !== lastCopiedContent) {
            addToCopyStack(copiedText.trim());
          }
        } catch (e) {
          console.log('Could not read clipboard in content script');
        }
      }, 100);
      return;
    }
    
    if (copiedText && copiedText !== lastCopiedContent) {
      lastCopiedContent = copiedText;
      addToCopyStack(copiedText);
    }
    
  } catch (error) {
    console.error('Error in copy event:', error);
  }
});

// Function to add content to copy stack
function addToCopyStack(content) {
  // Send to background script immediately
  chrome.runtime.sendMessage({
    action: 'addToCopyStack',
    content: content,
    source: {
      url: window.location.href,
      title: document.title,
      hostname: window.location.hostname
    }
  }).then(response => {
    if (response?.success) {
      console.log('✓ Added to copy stack:', content.substring(0, 30) + '...');
      
      // Show brief visual indicator (optional)
      showCopyIndicator();
    }
  }).catch(error => {
    console.error('Failed to add to copy stack:', error);
  });
}

// Visual indicator that something was copied
function showCopyIndicator() {
  // Create a small notification
  const indicator = document.createElement('div');
  indicator.innerHTML = '📋 Added to Copy Stack';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(34, 197, 94, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
  
  // Remove after 2 seconds
  setTimeout(() => {
    indicator.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, 2000);
}

// Listen for keyboard shortcuts
document.addEventListener('keydown', (event) => {
  // Ctrl/Cmd + Shift + C to open extension
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
    event.preventDefault();
    chrome.runtime.sendMessage({ action: 'openExtension' });
  }
});

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'pasteText') {
    pasteToActiveElement(message.text);
    sendResponse({ success: true });
  } else if (message.action === 'getCurrentSelection') {
    const selection = window.getSelection().toString().trim();
    sendResponse({ selection });
  }
});

// Function to paste text to active element
function pasteToActiveElement(text) {
  const activeElement = document.activeElement;
  
  if (activeElement && (
    activeElement.tagName === 'INPUT' || 
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.contentEditable === 'true'
  )) {
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
      const start = activeElement.selectionStart || 0;
      const end = activeElement.selectionEnd || 0;
      const value = activeElement.value || '';
      
      activeElement.value = value.substring(0, start) + text + value.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
      
      // Trigger events
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      activeElement.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // For contentEditable
      try {
        document.execCommand('insertText', false, text);
      } catch(e) {
        // Fallback for newer browsers
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
        }
      }
    }
  }
}