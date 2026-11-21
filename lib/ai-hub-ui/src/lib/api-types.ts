// The existing API returns these shapes. Keep the web app independent of the
// database package (which initializes a server-side connection on import).
export type AiProvider = {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  description: string;
  isActive: boolean | null;
  apiKeySet: boolean | null;
  createdAt: string | null;
};

export type Conversation = {
  id: string;
  providerId: string | null;
  title: string;
  isPinned: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Message = {
  id: string;
  conversationId: string | null;
  role: string;
  content: string;
  timestamp: string | null;
  responseTime: string | null;
};