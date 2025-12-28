
import { User, Channel, Item, Message, Conversation, Moment, BazaarPost, MomentComment, TradeSession, TradeOffer, TradeReview } from '../types';
import { db, auth, isFirebaseConfigured, firebase } from './firebase';
import { toast } from './toastService';

const INITIAL_ITEMS: Item[] = [
  { id: 'i1', name: '量子芯片', rarity: 'common', value: 50, description: '基础处理单元。' },
  { id: 'i2', name: '等离子电池', rarity: 'common', value: 75, description: '能量武器的燃料。' },
  { id: 'i3', name: '神经连接器', rarity: 'rare', value: 300, description: '直接脑机接口。' },
  { id: 'i4', name: '虚空水晶', rarity: 'legendary', value: 1000, description: '闪烁着暗能量。' },
];

export const ROLES = ['netrunner', 'merc', 'corpo', 'fixer', 'civilian', 'ai_construct'] as const;
const TITLES = ['街头小贩', '黑市中间人', '数据大亨', '暗影行者', '清道夫'];

class RealDBService {
  constructor() {
      if (!isFirebaseConfigured) {
          console.error("Firebase is not configured.");
      }
  }
  
  private ensureConnection() {
      if (!isFirebaseConfigured || !db || !auth) {
          toast.error("网络连接断开：数据库无法访问。");
          throw new Error("DB Connection Error");
      }
  }

  private getEmail(accountName: string) {
      return `${accountName.toLowerCase().replace(/\s+/g, '')}@neon.game`;
  }

  async login(accountName: string, password: string): Promise<{user?: User, error?: string}> {
      try {
          this.ensureConnection();
          const email = this.getEmail(accountName);
          const userCredential = await auth.signInWithEmailAndPassword(email, password);
          const uid = userCredential.user.uid;
          const userDoc = await db.collection("users").doc(uid).get();
          if (userDoc.exists) {
              const userData = userDoc.data() as User;
              await db.collection("users").doc(uid).update({ isOnline: true });
              return { user: { id: uid, ...userData } };
          }
          return { error: "档案丢失" };
      } catch (e: any) {
          return { error: e.message || "登录失败" };
      }
  }

  async register(accountName: string, username: string, password?: string, avatarUrl?: string): Promise<{user?: User, error?: string}> {
      try {
          this.ensureConnection();
          const email = this.getEmail(accountName);
          const existing = await db.collection("users").where("accountName", "==", accountName).get();
          if (!existing.empty) return { error: "账号已被注册" };
          const userCredential = await auth.createUserWithEmailAndPassword(email, password || "123456");
          const uid = userCredential.user.uid;
          const newUser = this.createNewUserObject(uid, accountName, username, undefined, avatarUrl);
          const { password: _, ...dbUser } = newUser;
          await db.collection("users").doc(uid).set(dbUser);
          return { user: newUser };
      } catch (e: any) {
          return { error: "注册失败: " + e.message };
      }
  }

  private createNewUserObject(id: string, accountName: string, username: string, password?: string, avatarUrl?: string, isNpc = false): User {
      const isRoot = accountName === 'admin';
      return {
            id, accountName, username,
            avatar: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${accountName}`,
            credits: isRoot ? 999999 : 500,
            inventory: [INITIAL_ITEMS[0], INITIAL_ITEMS[1]],
            friends: [], friendNicknames: {},
            createdAt: Date.now(),
            bio: isNpc ? 'Searching...' : '新接入的神经漫游者。',
            role: isNpc ? 'ai_construct' : (isRoot ? 'corpo' : 'civilian'),
            merchantStats: { level: 1, tradeCount: 0, reputation: 100, title: isRoot ? '系统主宰' : TITLES[0] },
            tradeExp: 0, reviews: [], isGuaranteed: isRoot,
            isOnline: true, isNpc, isAdmin: isRoot,
            position: { x: Math.random() * 80 + 10, y: Math.random() * 60 + 20 },
            currentChannelId: 'lobby', postHistory: []
      };
  }

  async toggleUserGuaranteed(userId: string, status: boolean): Promise<void> {
      this.ensureConnection();
      await db.collection("users").doc(userId).update({ isGuaranteed: status });
  }

  async getUser(userId: string): Promise<User | undefined> {
      const snap = await db.collection("users").doc(userId).get();
      return snap.exists ? ({ id: snap.id, ...snap.data() } as User) : undefined;
  }

  async getAllUsers(): Promise<User[]> {
      const snap = await db.collection("users").get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as User));
  }

  async findUserByAccountName(accountName: string): Promise<User | undefined> {
      const snap = await db.collection("users").where("accountName", "==", accountName).get();
      if (snap.empty) return undefined;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as User;
  }

  async updateUser(user: User): Promise<void> {
      const data = JSON.parse(JSON.stringify(user));
      delete data.id;
      await db.collection("users").doc(user.id).update(data);
  }

  async deleteUser(userId: string): Promise<void> {
      await db.collection("users").doc(userId).delete();
  }

  async updateUserCredits(userId: string, credits: number): Promise<void> {
      await db.collection("users").doc(userId).update({ credits });
  }

  async updateUserProfile(userId: string, updates: any): Promise<{success: boolean, error?: string, user?: User}> {
      try {
          await db.collection("users").doc(userId).update(updates);
          const u = await this.getUser(userId);
          return { success: true, user: u };
      } catch (e: any) { return { success: false, error: e.message }; }
  }

  async getChannelPosts(channelId: string): Promise<BazaarPost[]> {
      this.ensureConnection();
      const snap = await db.collection("posts").where("channelId", "==", channelId).get();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      
      return snap.docs
          .map((d: any) => ({ id: d.id, ...d.data() } as BazaarPost))
          .filter(p => (now - p.timestamp) < dayMs)
          .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getAllActivePosts(): Promise<BazaarPost[]> {
      this.ensureConnection();
      const snap = await db.collection("posts").get();
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      return snap.docs
          .map((d: any) => ({ id: d.id, ...d.data() } as BazaarPost))
          .filter(p => (now - p.timestamp) < dayMs);
  }

  async publishBazaarPost(userId: string, channelId: string, content: string): Promise<{success: boolean, user?: User, msg?: string}> {
      this.ensureConnection();
      const user = await this.getUser(userId);
      if (!user) return { success: false, msg: "用户不存在" };
      
      const postId = `post_${userId}_${channelId}`;
      const existingDoc = await db.collection("posts").doc(postId).get();
      
      const isUpdate = existingDoc.exists;

      if (!isUpdate && user.credits < 100) return { success: false, msg: "信用点不足 (需要 100 CR)" };

      const post: BazaarPost = {
          id: postId, userId, username: user.username, userAvatar: user.avatar,
          content, channelId, position: user.position, timestamp: Date.now()
      };

      const batch = db.batch();
      batch.set(db.collection("posts").doc(postId), post);
      
      if (!isUpdate) {
          batch.update(db.collection("users").doc(userId), { 
              credits: firebase.firestore.FieldValue.increment(-100),
              postHistory: firebase.firestore.FieldValue.arrayUnion(Date.now())
          });
      }
      
      await batch.commit();

      const updatedUser = await this.getUser(userId);
      return { success: true, user: updatedUser };
  }

  async deleteBazaarPost(postId: string): Promise<void> {
      this.ensureConnection();
      await db.collection("posts").doc(postId).delete();
  }

  async sendChannelMessage(channelId: string, user: User, text: string, imageContent?: string): Promise<void> {
      this.ensureConnection();
      // Fix: Use conditional field inclusion to avoid undefined error in Firebase
      const msg: any = {
          id: `cmsg_${Date.now()}`,
          channelId, 
          senderId: user.id, 
          senderName: user.username,
          text, 
          timestamp: Date.now()
      };
      
      if (imageContent) {
          msg.imageContent = imageContent;
      }

      await db.collection("channel_messages").doc(msg.id).set(msg);
  }

  async getChannelMessages(channelId: string): Promise<any[]> {
      this.ensureConnection();
      const now = Date.now();
      const halfHourMs = 30 * 60 * 1000;
      const snap = await db.collection("channel_messages").where("channelId", "==", channelId).get();
          
      return snap.docs
          .map((d: any) => d.data())
          .filter((m: any) => m.timestamp && (now - m.timestamp) < halfHourMs)
          .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  async addFriendDirectly(userId: string, targetId: string): Promise<User> {
      this.ensureConnection();
      const batch = db.batch();
      batch.update(db.collection("users").doc(userId), { 
          friends: firebase.firestore.FieldValue.arrayUnion(targetId)
      });
      batch.update(db.collection("users").doc(targetId), { 
          friends: firebase.firestore.FieldValue.arrayUnion(userId)
      });
      await batch.commit();
      return (await this.getUser(userId))!;
  }

  async sendFriendRequest(senderId: string, targetId: string): Promise<User> {
      return this.addFriendDirectly(senderId, targetId);
  }

  async acceptFriendRequest(userId: string, targetId: string): Promise<User> {
      return this.addFriendDirectly(userId, targetId);
  }

  async rejectFriendRequest(userId: string, targetId: string): Promise<User> {
      return (await this.getUser(userId))!;
  }

  async removeFriend(userId: string, targetId: string) {
      const batch = db.batch();
      batch.update(db.collection("users").doc(userId), { friends: firebase.firestore.FieldValue.arrayRemove(targetId) });
      batch.update(db.collection("users").doc(targetId), { friends: firebase.firestore.FieldValue.arrayRemove(userId) });
      await batch.commit();
      return (await this.getUser(userId))!;
  }

  async getChannels(search?: string): Promise<Channel[]> {
      const snap = await db.collection("channels").get();
      let res = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Channel));
      if (search) res = res.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
      return res;
  }
  async updateChannelBroadcast(channelId: string, message: string): Promise<void> {
      await db.collection("channels").doc(channelId).update({ broadcastMessage: message });
  }
  async createChannel(channel: any): Promise<Channel> {
      const newRef = db.collection("channels").doc();
      const newChan = { ...channel, id: newRef.id, playerCount: 1 };
      await newRef.set(newChan);
      return newChan;
  }
  async joinChannel(userId: string, channelId: string, password?: string): Promise<any> {
      const snap = await db.collection("channels").doc(channelId).get();
      if (!snap.exists) return { error: "不存在" };
      const channel = snap.data() as Channel;
      if (channel.isPrivate && channel.password !== password) return { error: "密码错误" };
      await db.collection("users").doc(userId).update({ currentChannelId: channelId });
      return { user: await this.getUser(userId) };
  }
  async getBazaarParticipants(channelId: string): Promise<User[]> {
      const snap = await db.collection("users").where("currentChannelId", "==", channelId).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as User));
  }
  async updateUserPosition(userId: string, x: number, y: number): Promise<void> {
      db.collection("users").doc(userId).update({ position: { x, y } });
  }
  async updateBazaarPostPosition(userId: string, channelId: string, pos: any) {
      const postId = `post_${userId}_${channelId}`;
      await db.collection("posts").doc(postId).update({ position: pos });
      await db.collection("users").doc(userId).update({ position: pos });
  }
  async tickNpcMovement(channelId: string) {}
  async getUsersByIds(ids: string[]): Promise<User[]> {
      if (ids.length === 0) return [];
      const snap = await db.collection("users").where("id", "in", ids.slice(0, 10)).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as User));
  }
  async getConversations(userId: string): Promise<Conversation[]> {
      const snap = await db.collection("conversations").where("participants", "array-contains", userId).get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Conversation));
  }
  async getPrivateMessages(conversationId: string): Promise<Message[]> {
      const snap = await db.collection("messages").where("conversationId", "==", conversationId).get();
      return snap.docs.map((d: any) => d.data() as Message).sort((a,b) => a.timestamp - b.timestamp);
  }
  async sendPrivateMessage(senderId: string, targetId: string, text: string, img?: string, opt?: any) {
      const participants = [senderId, targetId].sort();
      const conversationId = participants.join(':');
      const sender = await this.getUser(senderId);
      const msg: Message = {
          id: `msg_${Date.now()}`, conversationId, senderId, senderName: sender?.username || '?', 
          senderAvatar: sender?.avatar, text, type: opt?.type || 'text', timestamp: Date.now(),
          imageContent: img
      };
      await db.collection("messages").doc(msg.id).set(msg);
      await db.collection("conversations").doc(conversationId).set({ id: conversationId, participants, lastMessage: msg, unreadCounts: { [targetId]: 1 } }, { merge: true });
      return msg;
  }
  async markConversationAsRead(userId: string, cid: string) {
      await db.collection("conversations").doc(cid).set({ 
          unreadCounts: { 
              [userId]: 0 
          } 
      }, { merge: true });
  }
  async getTotalUnreadCount(userId: string): Promise<number> {
      const convs = await this.getConversations(userId);
      return convs.reduce((acc, c) => acc + (c.unreadCounts?.[userId] || 0), 0);
  }
  async createTradeSession(i: string, r: string) {
      const tid = `trade_${Date.now()}`;
      await db.collection("trades").doc(tid).set({ id: tid, participants: [i,r], offers: {[i]: {credits:0,items:[],isLocked:false}, [r]: {credits:0,items:[],isLocked:false}}, status:'pending', createdAt:Date.now() });
      return tid;
  }
  subscribeToTrade(tid: string, cb: any) {
      return db.collection("trades").doc(tid).onSnapshot((d: any) => cb(d.exists ? d.data() : null));
  }
  async updateTradeOffer(tid: string, uid: string, c: number, i: any[]) {
      await db.collection("trades").doc(tid).update({ [`offers.${uid}.credits`]: c, [`offers.${uid}.items`]: i, [`offers.${uid}.isLocked`]: false });
  }
  async toggleTradeLock(tid: string, uid: string, l: boolean) {
      await db.collection("trades").doc(tid).update({ [`offers.${uid}.isLocked`]: l });
  }
  async cancelTrade(tid: string) { await db.collection("trades").doc(tid).update({ status: 'cancelled' }); }
  async finalizeTrade(tid: string) {
      const ref = db.collection("trades").doc(tid);
      const tradeDoc = await ref.get();
      if (!tradeDoc.exists) return;
      const trade = tradeDoc.data() as TradeSession;
      const [p1,p2] = trade.participants;
      const u1 = (await db.collection("users").doc(p1).get()).data() as User;
      const u2 = (await db.collection("users").doc(p2).get()).data() as User;
      const o1 = trade.offers[p1];
      const o2 = trade.offers[p2];
      await db.collection("users").doc(p1).update({ credits: u1.credits - o1.credits + o2.credits });
      await db.collection("users").doc(p2).update({ credits: u2.credits - o2.credits + o1.credits });
      await ref.update({ status: 'completed' });
  }
  async getMoments(): Promise<Moment[]> {
      const snap = await db.collection("moments").orderBy("timestamp", "desc").limit(20).get();
      return snap.docs.map((d: any) => d.data() as Moment);
  }
  async createMoment(uid: string, n: string, a: string, t: string) {
      const m = { id:`m_${Date.now()}`, userId:uid, username:n, avatar:a, content:t, timestamp:Date.now(), likes:0, comments:0 };
      await db.collection("moments").doc(m.id).set(m);
  }
  async addMomentComment(mid: string, u: User, t: string) {
      const c = { id:`c_${Date.now()}`, userId:u.id, username:u.username, avatar:u.avatar, text:t, timestamp:Date.now() };
      await db.collection("moments").doc(mid).update({ commentsList: firebase.firestore.FieldValue.arrayUnion(c), comments: firebase.firestore.FieldValue.increment(1) });
  }
  async deleteConversation(id: string) { await db.collection("conversations").doc(id).delete(); }
  async deleteMessage(mid: string, cid: string) { await db.collection("messages").doc(mid).delete(); }
  async addTradeReview(uid: string, r: any) {
      const rev = { ...r, id:`rev_${Date.now()}`, timestamp:Date.now() };
      await db.collection("users").doc(uid).update({ reviews: firebase.firestore.FieldValue.arrayUnion(rev) });
  }
}

export const mockDb = new RealDBService();
export const ITEMS_DB = INITIAL_ITEMS;
