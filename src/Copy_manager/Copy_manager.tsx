// CopyManager.ts
// CopyManager.ts
import type { CopyItem, CopyStack, DuplicateWarning } from '../Types';

export class CopyManager {
  private stacks: Map<string, CopyStack> = new Map();
  private currentStackId: string = 'default';
  
  constructor() {
    this.loadFromStorage();
    this.initializeDefaultStack();
  }

  // Initialize default stack
  private initializeDefaultStack() {
    if (!this.stacks.has('default')) {
      const defaultStack: CopyStack = {
        id: 'default',
        name: 'Main Stack',
        items: [],
        created: Date.now(),
        lastModified: Date.now()
      };
      this.stacks.set('default', defaultStack);
    }
  }

  // Add item with duplicate checking
  addItem(content: string, source: { url: string; title: string }): DuplicateWarning {
    const trimmedContent = content.trim();
    
    // Check for exact duplicates
    const currentStack = this.getCurrentStack();
    const exactDuplicate = currentStack.items.find(item => 
      item.content.trim() === trimmedContent
    );

    if (exactDuplicate) {
      return {
        show: true,
        message: `This content was already copied ${this.getTimeAgo(exactDuplicate.timestamp)}`,
        existingItem: exactDuplicate,
        newContent: trimmedContent
      };
    }

    // Check for similar content (75% match)
    const similarItem = this.findSimilarContent(trimmedContent, currentStack.items);
    
    const newItem: CopyItem = {
      id: this.generateId(),
      content: trimmedContent,
      timestamp: Date.now(),
      source: {
        url: source.url,
        title: source.title,
        hostname: this.extractHostname(source.url)
      }
    };

    // Add to current stack (at beginning)
    currentStack.items.unshift(newItem);
    currentStack.lastModified = Date.now();
    
    // Limit stack size to 100 items
    if (currentStack.items.length > 100) {
      currentStack.items = currentStack.items.slice(0, 100);
    }

    this.saveToStorage();

    if (similarItem) {
      return {
        show: true,
        message: `Similar content found from ${similarItem.source.hostname}. Added anyway.`,
        existingItem: similarItem,
        newContent: trimmedContent
      };
    }

    return { show: false, message: '' };
  }

  // Find similar content using basic text similarity
  private findSimilarContent(content: string, items: CopyItem[]): CopyItem | null {
    const threshold = 0.75; // 75% similarity
    
    for (const item of items) {
      const similarity = this.calculateSimilarity(content, item.content);
      if (similarity >= threshold) {
        return item;
      }
    }
    return null;
  }

  // Simple similarity calculation
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  // Levenshtein distance for similarity
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Create new stack
  createStack(name: string): string {
    const stackId = this.generateId();
    const newStack: CopyStack = {
      id: stackId,
      name: name.trim() || `Stack ${this.stacks.size + 1}`,
      items: [],
      created: Date.now(),
      lastModified: Date.now()
    };
    
    this.stacks.set(stackId, newStack);
    this.saveToStorage();
    return stackId;
  }

  // Get all stacks
  getAllStacks(): CopyStack[] {
    return Array.from(this.stacks.values()).sort((a, b) => b.lastModified - a.lastModified);
  }

  // Get current stack
  getCurrentStack(): CopyStack {
    return this.stacks.get(this.currentStackId) || this.stacks.get('default')!;
  }

  // Switch to different stack
  switchStack(stackId: string) {
    if (this.stacks.has(stackId)) {
      this.currentStackId = stackId;
    }
  }

  // Delete item from current stack
  deleteItem(itemId: string) {
    const currentStack = this.getCurrentStack();
    const mostRecentId = currentStack.items[0]?.id;
  
    // Prevent deletion of the most recent item
    if (itemId === mostRecentId) {
      alert('Cannot delete the most recent copied item. This goes against system settings.');
      return;
    }
  
    currentStack.items = currentStack.items.filter(item => item.id !== itemId);
    currentStack.lastModified = Date.now();
    this.saveToStorage();
  }
  

  // Delete entire stack
  deleteStack(stackId: string) {
    if (stackId !== 'default' && this.stacks.has(stackId)) {
      this.stacks.delete(stackId);
      if (this.currentStackId === stackId) {
        this.currentStackId = 'default';
      }
      this.saveToStorage();
    }
  }

  // Clear current stack
  clearCurrentStack() {
    const currentStack = this.getCurrentStack();
    currentStack.items = [];
    currentStack.lastModified = Date.now();
    this.saveToStorage();
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private extractHostname(url: string): string {
    try {
      const a = document.createElement('a');
      a.href = url;
      return a.hostname.replace(/^www\./, '');
    } catch {
      return 'Unknown';
    }
  }
  

  private getTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  }

  // Storage methods
  private async saveToStorage() {
    const data = {
      stacks: Array.from(this.stacks.entries()),
      currentStackId: this.currentStackId
    };
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ copyStacks: data });
    } else {
      localStorage.setItem('copyStacks', JSON.stringify(data));
    }
  }

  private async loadFromStorage() {
    try {
      let data;
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get('copyStacks');
        data = result.copyStacks;
      } else {
        const stored = localStorage.getItem('copyStacks');
        data = stored ? JSON.parse(stored) : null;
      }
      
      if (data) {
        this.stacks = new Map(data.stacks);
        this.currentStackId = data.currentStackId || 'default';
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  }
}

export const copyManager = new CopyManager();