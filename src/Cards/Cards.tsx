import React from 'react';
import type{ CopyItem } from '../Types';
import './Cards.css';

interface CardProps {
  item: CopyItem;
  onDelete: (id: string) => void;
  onCopy: (content: string) => void;
}

const Cards: React.FC<CardProps> = ({ item, onDelete, onCopy }) => {
  const getTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use Chrome extension API instead of direct clipboard
    chrome.runtime.sendMessage({
      action: 'copyToClipboard',
      text: item.content
    }).then(response => {
      if (response?.success) {
        // Visual feedback
        const button = e.currentTarget as HTMLButtonElement;
        const originalText = button.innerHTML;
        button.innerHTML = '✓';
        button.style.background = 'rgba(34, 197, 94, 0.3)';
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = '';
        }, 1000);
        
        onCopy(item.content);
      }
    }).catch(error => {
      console.error('Copy failed:', error);
      
      // Fallback method
      try {
        const textarea = document.createElement('textarea');
        textarea.value = item.content;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        onCopy(item.content);
      } catch (fallbackError) {
        alert('Copy failed. Text: ' + item.content);
      }
    });
  };

  const getPreviewContent = (content: string, maxLength: number = 150): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-info">
          <h3 className="card-title">{item.source.title || 'Untitled'}</h3>
          <span className="card-time">{getTimeAgo(item.timestamp)}</span>
        </div>
        <div className="card-actions">
          <button 
            className="card-action copy-btn" 
            onClick={handleCopy}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
            title="Copy to clipboard"
          >
            📋
          </button>
          <button 
            className="card-action delete-btn" 
            onClick={() => onDelete(item.id)}
            title="Delete item"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <p className="card-content">{getPreviewContent(item.content)}</p>
      
      <div className="card-footer">
        <a 
          href={item.source.url} 
          target="_blank" 
          rel="noreferrer" 
          className="card-link"
        >
          {item.source.hostname}
        </a>
        <span className="card-size">{item.content.length} chars</span>
      </div>
    </div>
  );
};

export default Cards;