import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadData();
    
    // Refresh data when popup becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Popup visible, refreshing data...');
        loadData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also refresh every 2 seconds while popup is open
    const refreshInterval = setInterval(() => {
      if (!document.hidden) {
        loadData();
      }
    }, 2000);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
    };
  }, []);

  const loadData = () => {
    const stacks = copyManager.getAllStacks();
    const current = copyManager.getCurrentStack();
    setAllStacks(stacks);
    setCurrentStack(current);
  };

  const handleAddFromClipboard = async () => {
    try {
      // Method 1: Try direct clipboard read
      let clipboardText = '';
      
      try {
        clipboardText = await navigator.clipboard.readText();
      } catch (readError) {
        console.log('Direct clipboard read failed, trying alternative...');
        
        // Method 2: Ask user to paste
        const userText = prompt('Please paste your content here (Ctrl+V):');
        if (userText) {
          clipboardText = userText;
        } else {
          return; // User cancelled
        }
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
        
        // Show success message
        const addButton = document.querySelector('.add-btn') as HTMLButtonElement;
        if (addButton) {
          const originalText = addButton.innerHTML;
          addButton.innerHTML = '✓ Added';
          addButton.style.background = 'rgba(34, 197, 94, 0.3)';
          
          setTimeout(() => {
            addButton.innerHTML = originalText;
            addButton.style.background = '';
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Failed to add from clipboard:', error);
      alert('Failed to access clipboard. Please try copying the text again.');
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

  if (!currentStack) {
    return <div className="cards-holder loading">Loading...</div>;
  }

  return (
    <div className="cards-holder">
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
            className="header-btn add-btn"
            onClick={handleAddFromClipboard}
            title="Add from clipboard"
          >
            📋 Add
          </button>

          <button 
            className="header-btn clear-btn"
            onClick={handleClearStack}
            title="Clear all items"
          >
            🗑️ Clear
          </button>
        </div>

      </div>

      {/* Instructions */}
      <div className="instructions-banner">
        <span className="instructions-text">
          💡 Copy text anywhere - it will appear here automatically!
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
            <p>Copy some text on any webpage and it will automatically appear here!</p>
            <div className="empty-instructions">
              <p><strong>How to use:</strong></p>
              <p>1. Copy text anywhere (Ctrl+C)</p>
              <p>2. It appears here automatically</p>
              <p>3. Click 📋 to copy items back</p>
            </div>
          </div>
        ) : (
          // Map through actual copied items
          currentStack.items.map((item: CopyItem) => (
            <Cards
              key={item.id}
              item={item}
              onDelete={handleDeleteItem}
              onCopy={handleCopyItem}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Cards_holder;