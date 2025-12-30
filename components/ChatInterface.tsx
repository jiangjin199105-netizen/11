
import React, { useState, useEffect, useRef } from 'react';
import { User, Message, Conversation } from '../types';
import { mockDb } from '../services/mockDb';
import { Button } from './Button';
import { playNotificationSound } from '../services/audioService';
import { toast } from '../services/toastService';

interface ChatInterfaceProps {
  currentUser: User;
  initialTargetId?: string;
}

const formatPreciseTimestamp = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (isToday) return `今天 ${timeStr}`;
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `昨天 ${timeStr}`;
    
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser, initialTargetId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [participantsInfo, setParticipantsInfo] = useState<Record<string, User>>({});
  const [isLocalArchiveActive, setIsLocalArchiveActive] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);

  const loadConversations = async () => {
    try {
      const convs = await mockDb.getConversations(currentUser.id);
      setConversations(convs);
      
      const userIdsToFetch = new Set<string>();
      convs.forEach(c => c.participants.forEach(p => { if (p !== currentUser.id) userIdsToFetch.add(p); }));
      if (userIdsToFetch.size > 0) {
          const users = await mockDb.getUsersByIds(Array.from(userIdsToFetch));
          setParticipantsInfo(prev => {
              const next = { ...prev };
              users.forEach(u => next[u.id] = u);
              return next;
          });
      }
    } catch (e) {
        console.warn("Conv Load Error", e);
    }
  };

  const startChatWith = async (targetId: string) => {
    if (!targetId) return;
    const participants = [currentUser.id, targetId].sort();
    const convId = participants.join(':');
    if (!participantsInfo[targetId]) {
        const u = await mockDb.getUser(targetId);
        if (u) setParticipantsInfo(prev => ({ ...prev, [targetId]: u }));
    }
    setActiveConversationId(convId);
    await loadConversations(); 
  };

  const loadMessages = async (convId: string) => {
    try {
      const remoteMsgs = await mockDb.getPrivateMessages(convId);
      setMessages(remoteMsgs);
      await mockDb.markConversationAsRead(currentUser.id, convId);
    } catch (e) {
        console.warn("Msg Load Error", e);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (window.confirm('确定要从本地神经链路中彻底移除此频道吗？')) {
      await mockDb.deleteConversation(convId);
      if (activeConversationId === convId) setActiveConversationId(null);
      await loadConversations();
      toast.info("会话已移除");
    }
  };

  const handleClearHistory = async () => {
      if (!activeConversationId) return;
      if (window.confirm('警告：确定要清空此信道的所有历史信号吗？（不可撤销）')) {
          await mockDb.clearConversationMessages(activeConversationId);
          setMessages([]);
          await loadConversations();
          toast.info("历史记录已抹除");
      }
  };

  const handleDeleteMessage = async (msgId: string) => {
      if (!activeConversationId) return;
      await mockDb.deleteMessage(msgId, activeConversationId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      await loadConversations();
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConversationId || isSending) return;
    
    setIsSending(true);
    const parts = activeConversationId.split(':');
    let targetId = parts.length === 2 && parts[0] === parts[1] 
        ? parts[0] 
        : parts.find(p => p !== currentUser.id);
    
    if (!targetId) {
        setIsSending(false);
        return;
    }
    
    const textToSend = inputText.trim();
    setInputText(''); 

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
        id: tempId,
        senderId: currentUser.id,
        senderName: currentUser.username,
        text: textToSend,
        timestamp: Date.now(),
        type: 'text'
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
        const actualMsg = await mockDb.sendPrivateMessage(currentUser.id, targetId, textToSend, undefined, {
            senderName: currentUser.username
        });
        setMessages(prev => prev.map(m => m.id === tempId ? actualMsg : m));
        await loadConversations();
    } catch (e) { 
        console.error(e);
        toast.error("信道传输中断，请重试");
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setInputText(textToSend);
    } finally {
        setIsSending(false);
    }
  };

  useEffect(() => {
    if (initialTargetId) startChatWith(initialTargetId);
    else loadConversations();
    try {
        localStorage.setItem('__health__', 'ok');
        setIsLocalArchiveActive(true);
    } catch (e) {
        setIsLocalArchiveActive(false);
    }
  }, [currentUser.id, initialTargetId]);

  useEffect(() => {
      if (activeConversationId) {
          loadMessages(activeConversationId);
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = window.setInterval(() => loadMessages(activeConversationId), 5000);
      }
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeConversationId]);

  // 优化触底逻辑：使用 setTimeout 确保在 DOM 渲染完成后滚动
  useEffect(() => { 
    const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  return (
    <div className="flex-1 flex h-full bg-cyber-900 overflow-hidden font-mono text-gray-100">
      {/* 侧边栏 */}
      <aside className={`${activeConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-cyber-700 bg-cyber-800 shrink-0 z-10`}>
          <header className="h-16 flex flex-col justify-center px-4 border-b border-cyber-700 bg-cyber-900 shadow-xl">
              <h2 className="text-white font-black text-xs uppercase tracking-[0.2em] italic">神经网络信道 (Comm-Freq)</h2>
              <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isLocalArchiveActive ? 'bg-cyber-success animate-pulse' : 'bg-cyber-danger'}`}></div>
                  <span className="text-[9px] font-mono uppercase text-gray-500 tracking-wider">Sync: {isLocalArchiveActive ? 'ONLINE' : 'OFFLINE'}</span>
              </div>
          </header>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {conversations.length === 0 ? (
                  <div className="p-10 text-center opacity-30 text-xs uppercase font-mono tracking-widest leading-loose">No frequencies detected</div>
              ) : (
                  conversations.map(conv => {
                      const unread = conv.unreadCounts?.[currentUser.id] || 0;
                      const partnerId = conv.participants.find(p => p !== currentUser.id) || currentUser.id;
                      const partner = participantsInfo[partnerId];
                      const nickname = currentUser.friendNicknames?.[partnerId];
                      
                      return (
                          <div key={conv.id} onClick={() => setActiveConversationId(conv.id)} className={`p-4 border-b border-cyber-700/50 cursor-pointer hover:bg-cyber-700/30 transition-all group relative ${activeConversationId === conv.id ? 'bg-cyber-accent/5 shadow-inner' : ''}`}>
                              {activeConversationId === conv.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-accent shadow-[0_0_12px_#00f0ff]"></div>}
                              <div className="flex items-center gap-4">
                                  <img src={partner?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`} className="w-11 h-11 rounded-full border border-cyber-700 bg-black shadow-lg" alt="" />
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-baseline mb-1">
                                          <h3 className={`font-bold truncate text-sm transition-colors ${unread > 0 ? 'text-cyber-accent' : 'text-gray-200'}`}>
                                              {nickname || partner?.username || 'Wanderer'}
                                          </h3>
                                          <span className="text-[9px] font-mono text-gray-600">{conv.lastMessage ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                          <p className={`text-xs truncate ${unread > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>{conv.lastMessage?.text || '建立连接...'}</p>
                                          {unread > 0 && <span className="bg-cyber-accent text-cyber-900 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-2 animate-pulse shadow-[0_0_8px_#00f0ff]">{unread}</span>}
                                      </div>
                                  </div>
                              </div>
                              <button onClick={(e) => handleDeleteConversation(e, conv.id)} className="absolute right-2 top-2 p-1 text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                          </div>
                      );
                  })
              )}
          </div>
      </aside>

      {/* 聊天区域 - 核心变更：改为 flex-col 并移除 absolute 定位 */}
      <section className={`${!activeConversationId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-cyber-900 relative h-full`}>
          {activeConversationId ? (
              <>
                <header className="h-16 border-b border-cyber-700 flex items-center justify-between px-4 md:px-6 bg-cyber-800/80 backdrop-blur-md shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setActiveConversationId(null)} className="md:hidden p-2 -ml-2 text-cyber-accent hover:bg-cyber-accent/10 rounded-full">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        {(() => {
                            const partnerId = activeConversationId.split(':').find(p => p !== currentUser.id) || currentUser.id;
                            const partner = participantsInfo[partnerId];
                            const nickname = currentUser.friendNicknames?.[partnerId];
                            return (
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <img src={partner?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`} className="w-10 h-10 rounded-full border border-cyber-accent/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]" alt="" />
                                    </div>
                                    <div>
                                        <div className="font-black text-white text-sm md:text-base tracking-tight">
                                            {nickname || partner?.username || 'Establishing...'}
                                            {nickname && <span className="text-[10px] text-gray-500 ml-2 font-normal">({partner?.username})</span>}
                                        </div>
                                        <div className="text-[9px] text-cyber-accent font-mono uppercase tracking-widest opacity-60 italic">SECURE LINE ACTIVE</div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    <button onClick={handleClearHistory} title="Purge Frequency (清空聊天)" className="p-2.5 text-gray-600 hover:text-cyber-danger hover:bg-cyber-danger/10 rounded-full transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </header>

                {/* 消息区域：自然占据剩余空间 */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-6">
                    {messages.map((msg, idx) => {
                        const isMe = msg.senderId === currentUser.id;
                        const isPrevFromSame = idx > 0 && messages[idx-1].senderId === msg.senderId;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in ${isPrevFromSame ? '-mt-4' : ''} group`}>
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                                    {!isPrevFromSame && (
                                        <div className="flex items-center gap-2 mb-1.5 opacity-50">
                                            {!isMe && <span className="text-[10px] text-cyber-accent font-black uppercase italic">{msg.senderName}</span>}
                                            <span className="text-[9px] text-gray-500 font-mono tracking-tighter">{formatPreciseTimestamp(msg.timestamp)}</span>
                                        </div>
                                    )}
                                    <div className="relative flex items-center gap-2 group">
                                        {isMe && (
                                            <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-700 hover:text-cyber-danger transition-all order-first" title="Scrub msg">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                                            </button>
                                        )}
                                        <div className={`px-4 py-2.5 text-[13px] md:text-sm border backdrop-blur-sm rounded-2xl break-all overflow-wrap-anywhere ${isMe ? 'bg-cyber-accent/10 border-cyber-accent/30 text-cyber-accent rounded-tr-none' : 'bg-cyber-800/90 border-cyber-700 text-gray-200 rounded-tl-none'}`}>
                                            {msg.text}
                                        </div>
                                        {!isMe && (
                                            <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-700 hover:text-cyber-danger transition-all order-last">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {/* 滚动占位符 */}
                    <div ref={chatEndRef} className="h-4 w-full" />
                </div>

                {/* 输入区域：现在作为 Flex 容器的子元素，自然排在底部 */}
                <div className="shrink-0 p-3 md:p-6 bg-cyber-900/95 backdrop-blur-xl border-t border-cyber-700">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 max-w-5xl mx-auto items-center">
                        <input value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="输入加密信号..." className="flex-1 bg-cyber-800/80 border border-cyber-700 rounded-xl px-5 py-3 text-sm text-white focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent outline-none font-mono transition-all" />
                        <button type="submit" disabled={!inputText.trim() || isSending} className={`rounded-xl w-12 h-12 flex items-center justify-center shrink-0 transition-all ${inputText.trim() && !isSending ? 'bg-cyber-accent text-cyber-900 shadow-[0_0_15px_#00f0ff]' : 'bg-cyber-800 text-gray-600'}`}>
                            {isSending ? (
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            )}
                        </button>
                    </form>
                </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center opacity-30 select-none">
                  <div className="w-20 h-20 mb-6 rounded-3xl border-2 border-dashed border-gray-700 flex items-center justify-center animate-pulse">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] font-mono">Neural Link Idle</h3>
                  <p className="text-[10px] mt-2 font-mono uppercase tracking-widest">Select a frequency to begin secure communication</p>
              </div>
          )}
      </section>
    </div>
  );
};
