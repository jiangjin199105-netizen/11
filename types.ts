
export interface Item {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  value: number;
  description: string;
}

export interface TradeReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number; 
  comment: string;
  timestamp: number;
}

export interface MerchantStats {
  level: number;
  tradeCount: number;
  reputation: number; 
  title: string; 
}

export interface User {
  id: string;
  accountName: string;
  username: string;
  password?: string; 
  avatar: string;
  credits: number;
  inventory: Item[];
  
  friends: string[];
  friendNicknames?: Record<string, string>;
  
  createdAt: number;
  bio: string;
  role: 'netrunner' | 'merc' | 'corpo' | 'fixer' | 'civilian' | 'ai_construct';
  merchantStats: MerchantStats;
  isOnline?: boolean;
  isNpc?: boolean;
  isAdmin?: boolean;
  
  isGuaranteed?: boolean;
  tradeExp: number;
  reviews: TradeReview[];
  
  currentChannelId?: string;
  position: { x: number; y: number };
  postHistory: number[];
}

export interface BazaarPost {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  channelId: string;
  position: { x: number; y: number };
  timestamp: number;
}

export interface Message {
  id: string;
  conversationId?: string;
  channelId?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  imageContent?: string;
  type: 'text' | 'image' | 'system' | 'image_pending' | 'signal_answer' | 'trade_invite';
  timestamp: number;
  isSystem?: boolean;
  p2pSignal?: string;
  p2pRequestId?: string;
  fileMetadata?: {
      name: string;
      size: number;
      mimeType: string;
  };
  tradeId?: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: Message;
  unreadCounts: Record<string, number>;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  hostId: string;
  isPrivate: boolean;
  password?: string;
  playerCount: number;
  maxPlayers: number;
  tags: string[];
  broadcastMessage?: string;
}

export interface MomentComment {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  timestamp: number;
}

export interface Moment {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  timestamp: number;
  likes: number;
  comments: number;
  commentsList?: MomentComment[];
}

export interface TradeOffer {
    userId: string;
    credits: number;
    items: Item[];
    isLocked: boolean;
}

export interface TradeSession {
    id: string;
    participants: string[];
    offers: Record<string, TradeOffer>;
    status: 'pending' | 'active' | 'cancelled' | 'completed' | 'failed';
    createdAt: number;
}
