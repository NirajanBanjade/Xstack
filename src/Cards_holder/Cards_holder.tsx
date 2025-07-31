import React, { useState, useEffect, useRef } from 'react';
import Cards from '../Cards/Cards';
import { copyManager } from '../Copy_manager/Copy_manager';
import type { CopyStack, CopyItem, DuplicateWarning } from '../Types';
import './Cards_holder.css';

const Cards_holder: React.FC = () => {
  const [currentStack, setCurrentStack] = useState<CopyStack | null>(null);
  const [allStacks, setAllStacks] = useState<CopyStack[]>([]);
  const [showStackSelector, setShowStackSelector] = useState(false);
  const [newStackName, setNewStackName] = useState('');
  const [showCreateStack, setShowCreateStack] = useState(false);
  const [warning, setWarning] = useState<DuplicateWarning>({ show: false, message: '' });
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [, setDraggedItem] = useState<CopyItem | null>(null);
  const [isTransparent, setIsTransparent] = useState(false);
  // const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastItemCountRef = useRef<number>(0);

  useEffect(() => {
    const loadLatestData = () => {
      console.log("🔄 Popup opened → fetching latest copy stack");
      loadData(); // fetches from chrome.storage
    };
  
    // Initial load
    loadLatestData();
  
    // Keyboard shortcuts
    setupKeyboardShortcuts();
  
    // Listen for storage changes (optional if content/background handles it)
    const handleStorageChange = () => {
      console.log('🟢 Detected chrome.storage change');
      loadData();
    };
  
    if (chrome?.storage) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }
  
    // Refresh when popup becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadLatestData();
    });
  
    return () => {
      document.removeEventListener('visibilitychange', loadLatestData);
      if (chrome?.storage) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);
  
  

  const setupKeyboardShortcuts = () => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+C: Copy current clipboard content to stack
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        setTimeout(() => {
          handleAutoAddFromClipboard();
        }, 100);
      }
      
      // Ctrl+V: Paste last item
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && currentStack?.items.length) {
        e.preventDefault();
        const lastItem = currentStack.items[0];
        if (lastItem) {
          await navigator.clipboard.writeText(lastItem.content);
          setCopiedItem(lastItem.content);
          setTimeout(() => setCopiedItem(null), 1000);
        }
      }
      
      // Ctrl+Shift+T: Toggle transparency
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        setIsTransparent(!isTransparent);
      }
      
      // Escape: Close dropdowns
      if (e.key === 'Escape') {
        setShowStackSelector(false);
        setShowCreateStack(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  };

  // const startAutoRefresh = () => {
  //   // Fast refresh every 500ms to catch new copies immediately
  //   refreshIntervalRef.current = setInterval(() => {
  //     if (!document.hidden) {
  //       loadData();
  //     }
  //   }, 500);
  // };

  // const cleanup = () => {
  //   document.removeEventListener('keydown', setupKeyboardShortcuts);
  // };

  const loadData = () => {
    const stacks = copyManager.getAllStacks();
    const current = copyManager.getCurrentStack();
    
    // Check if new items were added
    if (current && lastItemCountRef.current < current.items.length) {
      console.log('New items detected!', current.items.length - lastItemCountRef.current);
      // Flash effect for new items
      if (lastItemCountRef.current > 0) {
        setWarning({
          show: true,
          message: `${current.items.length - lastItemCountRef.current} new item(s) added!`,
        });
        setTimeout(() => setWarning({ show: false, message: '' }), 2000);
      }
    }
    
    lastItemCountRef.current = current?.items.length || 0;
    setAllStacks(stacks);
    setCurrentStack(current);
  };

  const handleAutoAddFromClipboard = async () => {
    try {
      let clipboardText = '';
      
      try {
        clipboardText = await navigator.clipboard.readText();
      } catch (readError) {
        console.log('Direct clipboard read failed');
        return;
      }
      
      if (clipboardText?.trim()) {
        // Get current tab info for context
        let tabInfo = { url: 'extension', title: 'Manual Entry' };
        
        try {
          if (chrome?.tabs) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              tabInfo = {
                url: tab.url || 'unknown',
                title: tab.title || 'Unknown Page'
              };
            }
          }
        } catch (tabError) {
          console.log('Could not get tab info:', tabError);
        }
        
        const warning = copyManager.addItem(clipboardText, tabInfo);
        
        if (warning.show) {
          setWarning(warning);
          setTimeout(() => setWarning({ show: false, message: '' }), 3000);
        }
        
        loadData();
      }
    } catch (error) {
      console.error('Failed to auto-add from clipboard:', error);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    copyManager.deleteItem(itemId);
    loadData();
  };

  const handleCopyItem = (content: string) => {
    setCopiedItem(content);
    setTimeout(() => setCopiedItem(null), 1000);
  };

  const handleSwitchStack = (stackId: string) => {
    copyManager.switchStack(stackId);
    loadData();
    setShowStackSelector(false);
  };

  const handleCreateStack = () => {
    if (newStackName.trim()) {
      const stackId = copyManager.createStack(newStackName);
      copyManager.switchStack(stackId);
      loadData();
      setNewStackName('');
      setShowCreateStack(false);
      setShowStackSelector(false);
    }
  };

  const handleDeleteStack = (stackId: string) => {
    if (confirm('Are you sure you want to delete this stack?')) {
      copyManager.deleteStack(stackId);
      loadData();
    }
  };

  const handleClearStack = () => {
    if (confirm('Are you sure you want to clear all items in this stack?')) {
      copyManager.clearCurrentStack();
      loadData();
    }
  };

  const handleDragStart = (item: CopyItem) => {
    setDraggedItem(item);
  };

  if (!currentStack) {
    return <div className="cards-holder loading">Loading...</div>;
  }

  return (
    <div className={`cards-holder ${isTransparent ? 'transparent' : ''}`}>
      {/* Transparency Toggle */}
      <div className="transparency-controls">
        <button 
          className={`transparency-btn ${isTransparent ? 'active' : ''}`}
          onClick={() => setIsTransparent(!isTransparent)}
          title="Toggle transparency (Ctrl+Shift+T)"
        >
          {isTransparent ? '👁️' : '🔒'}
        </button>
      </div>

      {/* Header */}
      <div className="stack-header">
        <div className="stack-info">
          <button 
            className="stack-selector"
            onClick={() => setShowStackSelector(!showStackSelector)}
          >
            <span className="stack-name">{currentStack.name}</span>
            <span className="stack-count">({currentStack.items.length})</span>
            <span className="dropdown-arrow">▼</span>
          </button>
          
          {showStackSelector && (
            <div className="stack-dropdown">
              <div className="stack-list">
                {allStacks.map(stack => (
                  <div key={stack.id} className="stack-item">
                    <button
                      className={`stack-option ${stack.id === currentStack.id ? 'active' : ''}`}
                      onClick={() => handleSwitchStack(stack.id)}
                    >
                      <span>{stack.name}</span>
                      <span className="item-count">({stack.items.length})</span>
                    </button>
                    {stack.id !== 'default' && (
                      <button
                        className="delete-stack-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStack(stack.id);
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="stack-actions">
                {!showCreateStack ? (
                  <button
                    className="create-stack-btn"
                    onClick={() => setShowCreateStack(true)}
                  >
                    + New Stack
                  </button>
                ) : (
                  <div className="create-stack-form">
                    <input
                      type="text"
                      placeholder="Stack name..."
                      value={newStackName}
                      onChange={(e) => setNewStackName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateStack()}
                      autoFocus
                    />
                    <button onClick={handleCreateStack}>✓</button>
                    <button onClick={() => {
                      setShowCreateStack(false);
                      setNewStackName('');
                    }}>✕</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="header-actions">
          <button 
            className="header-btn clear-btn"
            onClick={handleClearStack}
            title="Clear all items"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Keyboard shortcuts info */}
      <div className="shortcuts-banner">
        <span className="shortcuts-text">
          ⌨️ Ctrl+C: Auto-add | Ctrl+V: Paste last | Drag cards to paste
        </span>
      </div>

      {/* Duplicate Warning */}
      {warning.show && (
        <div className="warning-banner">
          <span className="warning-icon">⚠️</span>
          <span className="warning-message">{warning.message}</span>
        </div>
      )}

      {/* Copy Success Notification */}
      {copiedItem && (
        <div className="copy-success">
          ✓ Copied to clipboard!
        </div>
      )}

      {/* Cards Container */}
      <div className="cards-container">
        {currentStack.items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No items copied yet</h3>
            <p>Copy some text anywhere (Ctrl+C) and it will automatically appear here!</p>
            <div className="empty-instructions">
              <p><strong>Auto-detection is active:</strong></p>
              <p>• Copy text anywhere → Appears automatically</p>
              <p>• Ctrl+V → Pastes last copied item</p>
              <p>• Drag cards to paste anywhere</p>
              <p>• Toggle transparency with 👁️ button</p>
            </div>
          </div>
        ) : (
          currentStack.items.map((item: CopyItem) => (
            <Cards
              key={item.id}
              item={item}
              onDelete={handleDeleteItem}
              onCopy={handleCopyItem}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Cards_holder;