// Types.ts
export interface CopyItem {
  id: string;
  content: string;
  timestamp: number;
  source: {
    url: string;
    title: string;
    hostname: string;
    timestamp?: number;        // Added: When source info was captured
    tabId?: number | null;     // Added: Browser tab ID
    method?: string;           // Added: Detection method
    detectionMethod?: string;  // Added: Alternative detection method field
  };
  wordCount?: number;          // Added: Word count (optional)
  charCount?: number;          // Added: Character count (optional)
}

export interface CopyStack {
  id: string;
  name: string;
  items: CopyItem[];
  created: number;
  lastModified: number;
}

export interface DuplicateWarning {
  show: boolean;
  message: string;
  existingItem?: CopyItem;
  newContent?: string;
}