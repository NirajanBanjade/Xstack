import React, { useState } from 'react';
import type{ CopyItem } from '../Types';
import './Cards.css';

interface CardProps {
  item: CopyItem;
  onDelete: (id: string) => void;
  onCopy: (content: string) => void;
  onDragStart: (item: CopyItem) => void;
  isLatest?: boolean;
}

const Cards: React.FC<CardProps> = ({ item, onDelete, onCopy, onDragStart, isLatest = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

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

  // Format URL for display - shortened version
  const getDisplayUrl = (url: string): string => {
    if (!url || url === 'extension' || url === 'unknown') {
      return item.source.title || 'Manual Entry';
    }
    
    try {
      const urlObj = new URL(url);
      let displayUrl = urlObj.hostname + urlObj.pathname;
      
      // Truncate if too long
      if (displayUrl.length > 35) {
        displayUrl = displayUrl.substring(0, 32) + '...';
      }
      
      return displayUrl;
    } catch {
      // If URL is invalid, fallback to title or shortened raw url
      return item.source.title || (url.length > 35 ? url.substring(0, 32) + '...' : url);
    }
  };

  // Check if URL is valid and clickable
  const isValidUrl = (url: string): boolean => {
    if (!url || url === 'extension' || url === 'unknown' || url === '') return false;
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsAnimating(true);
    
    try {
      await navigator.clipboard.writeText(item.content);
      
      const button = e.currentTarget as HTMLButtonElement;
      const originalText = button.innerHTML;
      button.innerHTML = '✓';
      button.style.background = 'rgba(34, 197, 94, 0.3)';
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.style.background = '';
        setIsAnimating(false);
      }, 1000);
      
      onCopy(item.content);
    } catch (error) {
      console.error('Copy failed:', error);
      
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
        chrome.runtime.sendMessage({
          action: 'copyToClipboard',
          text: item.content
        });
      }
      setIsAnimating(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', item.content);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(item);
    
    const dragImage = document.createElement('div');
    dragImage.innerHTML = `
      <div style="
        background: rgba(255,255,255,0.95);
        border: 2px dashed #3b82f6;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        color: #1f2937;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 200px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      ">
        📋 ${item.content.substring(0, 30)}${item.content.length > 30 ? '...' : ''}
      </div>
    `;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const getPreviewContent = (content: string, maxLength: number = 150): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isValidUrl(item.source.url)) {
      window.open(item.source.url, '_blank', 'noreferrer');
    }
  };

  return (
    <div 
      className={`card ${isDragging ? 'dragging' : ''} ${isAnimating ? 'animating' : ''} ${isLatest ? 'latest-item' : ''}`}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="card-header">
        <div className="card-info">
          <div className="card-title-row">
            {isValidUrl(item.source.url) ? (
              <a 
                href={item.source.url}
                target="_blank"
                rel="noreferrer"
                className="card-title-link"
                onClick={handleTitleClick}
                title={`Visit: ${item.source.url}`}
              >
                {getDisplayUrl(item.source.url)}
              </a>
            ) : (
              <span className="card-title">
                {getDisplayUrl(item.source.url)}
              </span>
            )}
            {isLatest && (
              <span className="latest-badge" title="Will be pasted with Ctrl+V">
                🚀 Latest
              </span>
            )}
          </div>
          <span className="card-time">{getTimeAgo(item.timestamp)}</span>
        </div>
        <div className="card-actions">
          <button 
            className="card-action copy-btn" 
            onClick={handleCopy}
            onMouseDown={(e) => e.preventDefault()}
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
      
      <div className="drag-indicator">
        <span>🖱️ Drag to paste anywhere</span>
      </div>
      
      {isLatest && (
        <div className="ctrl-v-indicator">
          <span>⌨️ Ctrl+V will paste this item</span>
        </div>
      )}
    </div>
  );
};

export default Cards;