// types.ts
export interface CopyItem {
    id: string;
    content: string;
    timestamp: number;
    source: {
      url: string;
      title: string;
      hostname: string;
    };
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