export enum Role {
  USER = 'user',
  MODEL = 'model'
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