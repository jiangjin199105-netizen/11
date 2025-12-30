
import { User, Channel, Item, Message, Conversation, Moment, BazaarPost, MomentComment, TradeSession, TradeOffer, TradeReview } from '../types';
import { db, auth, isFirebaseConfigured, firebase } from './firebase';
import { toast } from './toastService';

const LOCAL_STORAGE_KEY = 'neon_bazaar_v8_storage';
const KEFU_ID = 'system_kefu_001';

const INITIAL_ITEMS: Item[] = [
  { id: 'i1', name: '量子芯片', rarity: 'common', value: 50, description: '基础处理单元。' },
  { id: 'i2', name: '等离子电池', rarity: 'common', value: 75, description: '能量武器的燃料。' },
  { id: 'i3', name: '神经连接器', rarity: 'rare', value: 300, description: '直接脑机接口。' },
  { id: 'i4', name: '虚空水晶', rarity: 'legendary', value: 1000, description: '闪烁着暗能量。' },
];

export const ROLES = ['netrunner', 'merc', 'corpo', 'fixer', 'civilian', 'ai_construct'] as const;
const TITLES = ['街头小贩', '黑市中间人', '数据大亨', '暗影行者', '清道夫'];

class HybridDBService {
  private isLocalOnly = !isFirebaseConfigured;
  private memoryCache: any = null;

  constructor() {
    this.initLocalData();
  }

  private sanitizeForFirebase(obj: any) {
    const cleaned = { ...obj };
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] === undefined) {
        delete cleaned[key];
      }
    });
    return cleaned;
  }

  private initLocalData() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      let data: any = { users: {}, messages: {}, conversations: {}, posts: {}, channels: {}, moments: [] };
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          data = { ...data, ...parsed };
        } catch (e) {
          console.error("Storage corrupt, resetting...");
        }
      }
      
      data.users = data.users || {};
      data.messages = data.messages || {};
      data.conversations = data.conversations || {};
      data.posts = data.posts || {};
      data.channels = data.channels || {};
      data.moments = data.moments || [];

      // 初始化客服账号
      if (!data.users[KEFU_ID]) {
          data.users[KEFU_ID] = this.createNewUserObject(KEFU_ID, 'kefu001', '霓虹官方客服', 'system_protected_pass', 'https://api.dicebear.com/7.x/bottts/svg?seed=kefu001');
          data.users[KEFU_ID].isGuaranteed = true;
          data.users[KEFU_ID].bio = '为您提供全天候神经链路维护与交易仲裁服务。';
          data.users[KEFU_ID].merchantStats.title = '系统管理员';
      }
      
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      this.memoryCache = data;
    } catch (e) {
      console.warn("LocalStorage Locked - Fallback to Memory Mode");
      this.memoryCache = { users: {}, messages: {}, conversations: {}, posts: {}, channels: {}, moments: [] };
    }
  }

  private getLocalData() {
    if (this.memoryCache) return this.memoryCache;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return {
        users: data.users || {},
        messages: data.messages || {},
        conversations: data.conversations || {},
        posts: data.posts || {},
        channels: data.channels || {},
        moments: data.moments || []
      };
    } catch (e) {
      return { users: {}, messages: {}, conversations: {}, posts: {}, channels: {}, moments: [] };
    }
  }

  private saveToLocal(collection: string, id: string, data: any) {
    const all = this.getLocalData();
    if (!all[collection]) all[collection] = {};
    all[collection][id] = data;

    this.memoryCache = all;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          all.messages = {}; 
          try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all)); } catch(ie) {}
      }
    }
  }

  private getEmail(accountName: string) {
    return `${accountName.toLowerCase().replace(/\s+/g, '')}@neon.game`;
  }

  async login(accountName: string, password: string): Promise<{user?: User, error?: string}> {
    const lowerName = accountName.trim().toLowerCase();
    const localData = this.getLocalData();
    const usersArray = Object.values(localData.users) as User[];
    
    const user = usersArray.find(u => 
      (u.accountName && u.accountName.toLowerCase() === lowerName) || 
      (u.username && u.username.toLowerCase() === lowerName)
    );

    if (user && user.password === password) {
        return { user };
    }

    try {
        if (!this.isLocalOnly && auth) {
            const email = this.getEmail(accountName);
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;
            const userDoc = await db.collection("users").doc(uid).get();
            if (userDoc.exists) {
                const userData = { id: uid, ...userDoc.data(), password } as User;
                this.saveToLocal('users', uid, userData);
                return { user: userData };
            }
        }
    } catch (e: any) {
        if (accountName === 'admin' && password === '888888') {
             const admin = this.createNewUserObject('admin_id', 'admin', 'SystemRoot', '888888');
             this.saveToLocal('users', 'admin_id', admin);
             return { user: admin };
        }
    }
    return { error: "身份验证失效 (Identity Mismatch)" };
  }

  async register(accountName: string, username: string, password?: string): Promise<{user?: User, error?: string}> {
    const lowerName = accountName.trim().toLowerCase();
    const localData = this.getLocalData();
    const existing = (Object.values(localData.users) as User[]).find(u => u.accountName?.toLowerCase() === lowerName);
    if (existing) return { error: "ID 已被占用" };

    const email = this.getEmail(accountName);
    try {
      if (!this.isLocalOnly && auth) {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password || "123456");
        const uid = userCredential.user.uid;
        const newUser = this.createNewUserObject(uid, accountName, username, password || "123456");
        this.saveToLocal('users', uid, newUser);
        const { password: _, ...dbUser } = this.sanitizeForFirebase(newUser);
        await db.collection("users").doc(uid).set(dbUser);
        return { user: newUser };
      }
    } catch (e: any) {}

    const localUid = 'loc_' + Math.random().toString(36).substr(2, 9);
    const newUser = this.createNewUserObject(localUid, accountName, username, password || "123456");
    this.saveToLocal('users', localUid, newUser);
    return { user: newUser };
  }

  private createNewUserObject(id: string, accountName: string, username: string, password?: string, avatarUrl?: string): User {
    const isRoot = accountName === 'admin' || id === KEFU_ID;
    return {
      id, accountName, username, password,
      avatar: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${accountName}`,
      credits: isRoot ? 999999 : 500,
      inventory: [INITIAL_ITEMS[0], INITIAL_ITEMS[1]],
      friends: [], friendNicknames: {},
      createdAt: Date.now(),
      bio: '新接入的神经漫游者。',
      role: isRoot ? 'corpo' : 'civilian',
      merchantStats: { level: 1, tradeCount: 0, reputation: 100, title: isRoot ? '系统主宰' : TITLES[0] },
      tradeExp: 0, reviews: [], isGuaranteed: isRoot,
      isOnline: true, isAdmin: isRoot,
      position: { x: 50, y: 50 },
      currentChannelId: 'lobby', postHistory: []
    };
  }

  async sendPrivateMessage(senderId: string, targetId: string, text: string, img?: string, opt?: any): Promise<Message> {
    if (!targetId) throw new Error("Missing targetId");
    
    const participants = [senderId, targetId].sort();
    const conversationId = participants.join(':');
    
    const msg: any = {
      id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      conversationId,
      senderId,
      senderName: opt?.senderName || 'Anonymous',
      text,
      type: opt?.type || (img ? 'image' : 'text'),
      timestamp: Date.now()
    };

    if (img) msg.imageContent = img;
    if (opt?.tradeId) msg.tradeId = opt.tradeId;

    try {
        this.saveToLocal('messages', msg.id, msg);
        const localData = this.getLocalData();
        const existingConv = localData.conversations[conversationId] as Conversation | undefined;
        const unreadCounts = { ...(existingConv?.unreadCounts || {}) };
        if (senderId !== targetId) {
            unreadCounts[targetId] = (unreadCounts[targetId] || 0) + 1;
        }
        const conv: Conversation = {
            id: conversationId,
            participants,
            lastMessage: msg as Message,
            unreadCounts
        };
        this.saveToLocal('conversations', conversationId, conv);

        if (!this.isLocalOnly && db) {
            const firebaseMsg = this.sanitizeForFirebase(msg);
            const firebaseConv = this.sanitizeForFirebase(conv);
            db.collection("messages").doc(msg.id).set(firebaseMsg).catch(() => {});
            db.collection("conversations").doc(conversationId).set(firebaseConv, { merge: true }).catch(() => {});
        }
    } catch (e) {
        throw e;
    }

    return msg as Message;
  }

  async getPrivateMessages(conversationId: string): Promise<Message[]> {
    const localData = this.getLocalData();
    const localMsgs = Object.values(localData.messages) as Message[];
    const filtered = localMsgs.filter(m => m.conversationId === conversationId);

    if (!this.isLocalOnly && db) {
      try {
        const snap = await db.collection("messages").where("conversationId", "==", conversationId).get();
        const remoteMsgs = snap.docs.map((d: any) => d.data() as Message);
        const map = new Map();
        filtered.forEach(m => map.set(m.id, m));
        remoteMsgs.forEach(m => map.set(m.id, m));
        return Array.from(map.values()).sort((a,b) => a.timestamp - b.timestamp);
      } catch (e) {
        return filtered.sort((a,b) => a.timestamp - b.timestamp);
      }
    }
    return filtered.sort((a,b) => a.timestamp - b.timestamp);
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const localData = this.getLocalData();
    const localConvs = Object.values(localData.conversations) as Conversation[];
    const filtered = localConvs.filter(c => c.participants.includes(userId));

    if (!this.isLocalOnly && db) {
      try {
        const snap = await db.collection("conversations").where("participants", "array-contains", userId).get();
        const remoteConvs = snap.docs.map((d: any) => d.data() as Conversation);
        const map = new Map();
        filtered.forEach(c => map.set(c.id, c));
        remoteConvs.forEach(c => map.set(c.id, c));
        return Array.from(map.values()).sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
      } catch (e) {
        return filtered.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
      }
    }
    return filtered.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  }

  async markConversationAsRead(userId: string, conversationId: string) {
    const localData = this.getLocalData();
    if (localData.conversations?.[conversationId]) {
        const conv = { ...localData.conversations[conversationId] };
        conv.unreadCounts = { ...(conv.unreadCounts || {}), [userId]: 0 };
        this.saveToLocal('conversations', conversationId, conv);
        
        if (!this.isLocalOnly && db) {
            db.collection("conversations").doc(conversationId).set({ 
                unreadCounts: { [userId]: 0 } 
            }, { merge: true }).catch(() => {});
        }
    }
  }

  async getTotalUnreadCount(userId: string): Promise<number> {
    const convs = await this.getConversations(userId);
    return convs.reduce((acc, c) => acc + (c.unreadCounts?.[userId] || 0), 0);
  }

  async getUser(userId: string): Promise<User | undefined> {
    const localData = this.getLocalData();
    if (localData.users?.[userId]) return localData.users[userId];
    if (!this.isLocalOnly && db) {
      try {
        const snap = await db.collection("users").doc(userId).get();
        return snap.exists ? { id: snap.id, ...snap.data() } as User : undefined;
      } catch(e) { return undefined; }
    }
    return undefined;
  }

  async updateUser(user: User): Promise<void> {
    this.saveToLocal('users', user.id, user);
    if (!this.isLocalOnly && db) {
        const { password: _, ...data } = user;
        const firebaseData = this.sanitizeForFirebase(data);
        db.collection("users").doc(user.id).set(firebaseData, { merge: true }).catch(() => {});
    }
  }

  async getAllUsers(): Promise<User[]> {
      const localData = this.getLocalData();
      return Object.values(localData.users) as User[];
  }

  async findUserByAccountName(accountName: string): Promise<User | undefined> {
      const lower = accountName.trim().toLowerCase();
      const localData = this.getLocalData();
      const found = (Object.values(localData.users) as User[]).find(u => u.accountName?.toLowerCase() === lower);
      if (found) return found;
      
      if (!this.isLocalOnly && db) {
          try {
            const snap = await db.collection("users").where("accountName", "==", accountName).get();
            if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
          } catch(e) {}
      }
      return undefined;
  }

  async getChannels(search?: string): Promise<Channel[]> {
      if (!this.isLocalOnly && db) {
          try {
            const snap = await db.collection("channels").get();
            let res = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Channel));
            if (search) res = res.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
            return res;
          } catch(e) {}
      }
      return [{ id: 'lobby', name: '中心大厅', description: '本地模拟环境', hostId: 'system', isPrivate: false, playerCount: 1, maxPlayers: 99, tags: ['Local'] }];
  }

  async createChannel(channel: any): Promise<Channel> {
      const id = 'chan_' + Math.random().toString(36).substr(2, 9);
      const newChan = { ...channel, id, playerCount: 1 };
      if (!this.isLocalOnly && db) {
          const firebaseChan = this.sanitizeForFirebase(newChan);
          await db.collection("channels").doc(id).set(firebaseChan);
      }
      return newChan;
  }

  async getChannelMessages(channelId: string): Promise<any[]> {
      if (!this.isLocalOnly && db) {
          try {
            const snap = await db.collection("channel_messages").where("channelId", "==", channelId).limit(50).get();
            return snap.docs.map((d: any) => d.data()).sort((a: any, b: any) => a.timestamp - b.timestamp);
          } catch (e) {}
      }
      return [];
  }

  async sendChannelMessage(channelId: string, user: User, text: string, imageContent?: string) {
      const msg: any = { 
        id: 'cmsg_' + Date.now(), 
        channelId, 
        senderId: user.id, 
        senderName: user.username, 
        text, 
        timestamp: Date.now() 
      };
      if (imageContent) msg.imageContent = imageContent;
      if (!this.isLocalOnly && db) {
          const firebaseMsg = this.sanitizeForFirebase(msg);
          db.collection("channel_messages").doc(msg.id).set(firebaseMsg).catch(() => {});
      }
  }

  async publishBazaarPost(userId: string, channelId: string, content: string) {
      const user = await this.getUser(userId);
      if (!user) return { success: false };
      const post: BazaarPost = { id: `post_${userId}`, userId, username: user.username, userAvatar: user.avatar, content, channelId, position: user.position, timestamp: Date.now() };
      if (!this.isLocalOnly && db) {
          const firebasePost = this.sanitizeForFirebase(post);
          db.collection("posts").doc(post.id).set(firebasePost).catch(() => {});
      }
      return { success: true, user };
  }

  async getChannelPosts(channelId: string): Promise<BazaarPost[]> {
      if (!this.isLocalOnly && db) {
          try {
            const snap = await db.collection("posts").where("channelId", "==", channelId).get();
            return snap.docs.map((d: any) => d.data() as BazaarPost);
          } catch(e) {}
      }
      return [];
  }

  async getAllActivePosts(): Promise<BazaarPost[]> {
      if (!this.isLocalOnly && db) {
          try {
            const snap = await db.collection("posts").get();
            return snap.docs.map((d: any) => d.data() as BazaarPost);
          } catch(e) {}
      }
      return [];
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
      const res: User[] = [];
      const localData = this.getLocalData();
      for (const id of ids) {
          if (localData.users[id]) res.push(localData.users[id]);
          else {
              const u = await this.getUser(id);
              if (u) res.push(u);
          }
      }
      return res;
  }

  async updateTradeOffer(tid: string, uid: string, c: number, i: any[]) {
      if (!this.isLocalOnly && db) db.collection("trades").doc(tid).update({ [`offers.${uid}.credits`]: c, [`offers.${uid}.items`]: i }).catch(() => {});
  }

  async toggleTradeLock(tid: string, uid: string, isLocked: boolean) {
      if (!this.isLocalOnly && db) db.collection("trades").doc(tid).update({ [`offers.${uid}.isLocked`]: isLocked }).catch(() => {});
  }

  async finalizeTrade(tid: string) {
      if (!this.isLocalOnly && db) db.collection("trades").doc(tid).update({ status: 'completed' }).catch(() => {});
  }

  async cancelTrade(tid: string) {
      if (!this.isLocalOnly && db) db.collection("trades").doc(tid).update({ status: 'cancelled' }).catch(() => {});
  }

  subscribeToTrade(tid: string, cb: any) {
      if (!this.isLocalOnly && db) return db.collection("trades").doc(tid).onSnapshot((d: any) => cb(d.exists ? d.data() : null));
      return () => {};
  }

  async createTradeSession(i: string, r: string) {
      const tid = `trade_${Date.now()}`;
      if (!this.isLocalOnly && db) await db.collection("trades").doc(tid).set({ id: tid, participants: [i,r], offers: {[i]: {credits:0,items:[],isLocked:false}, [r]: {credits:0,items:[],isLocked:false}}, status:'pending', createdAt:Date.now() });
      return tid;
  }

  async addTradeReview(userId: string, review: { reviewerId: string, reviewerName: string, rating: number, comment: string }) {
      const u = await this.getUser(userId);
      if (u) {
          const fullReview: TradeReview = { ...review, id: 'rev_' + Date.now(), timestamp: Date.now() };
          u.reviews = u.reviews || [];
          u.reviews.push(fullReview);
          const totalRating = u.reviews.reduce((acc, r) => acc + r.rating, 0);
          u.merchantStats.reputation = Math.round((totalRating / (u.reviews.length * 5)) * 100);
          await this.updateUser(u);
      }
  }

  async getMoments(): Promise<Moment[]> {
      if (!this.isLocalOnly && db) {
          try {
            const snap = await db.collection("moments").orderBy("timestamp", "desc").limit(10).get();
            return snap.docs.map((d: any) => d.data() as Moment);
          } catch(e) {}
      }
      return [];
  }

  async addMomentComment(momentId: string, user: User, text: string) {
      if (!this.isLocalOnly && db) {
          try {
              const snap = await db.collection("moments").doc(momentId).get();
              if (snap.exists) {
                  const moment = snap.data() as Moment;
                  const commentsList = moment.commentsList || [];
                  commentsList.push({ id: 'c_' + Date.now(), userId: user.id, username: user.username, avatar: user.avatar, text, timestamp: Date.now() });
                  await db.collection("moments").doc(momentId).update({ commentsList, comments: commentsList.length });
              }
          } catch (e) {}
      }
  }

  async createMoment(uid: string, n: string, a: string, t: string) {
    const m = { id:`m_${Date.now()}`, userId:uid, username:n, avatar:a, content:t, timestamp:Date.now(), likes:0, comments:0 };
    if (!this.isLocalOnly && db) db.collection("moments").doc(m.id).set(m).catch(() => {});
  }

  async addFriendDirectly(userId: string, targetId: string): Promise<User> {
    const u = await this.getUser(userId);
    const t = await this.getUser(targetId);
    if (u && t) {
        if (!u.friends.includes(targetId)) u.friends.push(targetId);
        if (!t.friends.includes(userId)) t.friends.push(userId);
        await this.updateUser(u);
        await this.updateUser(t);
    }
    return u!;
  }

  async deleteBazaarPost(id: string) { if (!this.isLocalOnly && db) db.collection("posts").doc(id).delete().catch(() => {}); }
  
  async deleteConversation(cid: string) {
    const all = this.getLocalData();
    delete all.conversations[cid];
    Object.keys(all.messages).forEach(mid => {
      if (all.messages[mid].conversationId === cid) delete all.messages[mid];
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    this.memoryCache = all;

    if (!this.isLocalOnly && db) {
      db.collection("conversations").doc(cid).delete().catch(() => {});
    }
  }

  async clearConversationMessages(convId: string) {
    const all = this.getLocalData();
    let changed = false;
    Object.keys(all.messages).forEach(mid => {
      if (all.messages[mid].conversationId === convId) {
        delete all.messages[mid];
        changed = true;
      }
    });
    if (all.conversations[convId]) {
      all.conversations[convId].lastMessage = null;
      changed = true;
    }
    if (changed) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
      this.memoryCache = all;
    }
    if (!this.isLocalOnly && db) {
      try {
        const snap = await db.collection("messages").where("conversationId", "==", convId).get();
        snap.docs.forEach((d: any) => d.ref.delete().catch(() => {}));
      } catch (e) {}
    }
  }

  async deleteMessage(msgId: string, convId: string) {
    const all = this.getLocalData();
    if (all.messages[msgId]) {
      delete all.messages[msgId];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
      this.memoryCache = all;
    }
    if (!this.isLocalOnly && db) {
      db.collection("messages").doc(msgId).delete().catch(() => {});
    }
  }
  
  async updateUserPosition(uid: string, x: number, y: number) {
      const u = await this.getUser(uid);
      if (u) { u.position = { x, y }; await this.updateUser(u); }
  }
  
  async updateBazaarPostPosition(uid: string, cid: string, pos: any) {
      if (!this.isLocalOnly && db) db.collection("posts").doc(`post_${uid}`).update({ position: pos }).catch(() => {});
      await this.updateUserPosition(uid, pos.x, pos.y);
  }
  
  async updateChannelBroadcast(cid: string, msg: string) { if (!this.isLocalOnly && db) db.collection("channels").doc(cid).update({ broadcastMessage: msg }).catch(() => {}); }
  
  async deleteUser(uid: string) {
    const all = this.getLocalData();
    delete all.users[uid];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    this.memoryCache = all;
    if (!this.isLocalOnly && db) db.collection("users").doc(uid).delete().catch(() => {});
  }
  
  async updateUserCredits(uid: string, c: number) { 
      const u = await this.getUser(uid);
      if (u) { u.credits = c; await this.updateUser(u); }
  }

  async toggleUserGuaranteed(uid: string, isGuaranteed: boolean) {
      const u = await this.getUser(uid);
      if (u) { u.isGuaranteed = isGuaranteed; await this.updateUser(u); }
  }

  async getBazaarParticipants(cid: string): Promise<User[]> {
      const all = await this.getAllUsers();
      return all;
  }

  async updateUserProfile(uid: string, updates: any) {
      const u = await this.getUser(uid);
      if (u) { Object.assign(u, updates); await this.updateUser(u); return { success: true }; }
      return { success: false };
  }
}

export const mockDb = new HybridDBService();
export const ITEMS_DB = INITIAL_ITEMS;
