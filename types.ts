export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export type ModelId = 
  | 'gemini-2.0-flash' 
  | 'gemini-2.0-flash-lite-preview-02-05' 
  | 'gemini-1.5-flash' 
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash-8b'
  | 'gemini-2.0-pro-exp-02-05'
  | 'gemini-2.0-flash-thinking-exp-01-21';

export interface ModelConfig {
  id: ModelId;
  name: string;
  description: string;
  rpm: number; // Requests Per Minute (Free Tier)
  rpd: number; // Requests Per Day (Free Tier)
  tpm: string; // Tokens Per Minute (Display)
  isNew?: boolean;
  isStable?: boolean;
  isPro?: boolean; // High intelligence, low rate limit
  isExperimental?: boolean;
}

export interface UsageStats {
  [modelId: string]: {
    minuteCount: number;
    lastMinuteReset: number;
    dayCount: number;
    lastDayReset: number;
  }
}

export interface VisitorLog {
  id: string;
  ip: string;
  location: string;
  timestamp: string;
  modelUsed: string;
  status: 'Success' | 'Rate Limited' | 'Error';
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  isError?: boolean;
  isBookmarked?: boolean;
  bookmarkNote?: string;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'file' | 'link';
  isActive: boolean;
}

export interface Task {
  id: string;
  text: string;
  dueDate: string; // YYYY-MM-DD
  isCompleted: boolean;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}