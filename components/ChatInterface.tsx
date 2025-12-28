
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

const LOCAL_STORAGE_KEY = 'neon_chat_history_v2_';

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser, initialTargetId }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [participantsInfo, setParticipantsInfo] = useState<Record<string, User>>({});
  const [localMedia, setLocalMedia] = useState<Record<string, string>>({});
  
  const activePCs = useRef<Record<string, RTCPeerConnection>>({});
  const fileChunks = useRef<Record<string, { received: number, total: number, chunks: ArrayBuffer[] }>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prevMessagesLengthRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  // --- 持久化与同步 ---
  const saveToLocal = (convId: string, msgs: Message[]) => {
      try { localStorage.setItem(`${LOCAL_STORAGE_KEY}${currentUser.id}_${convId}`, JSON.stringify(msgs.slice(-100))); } catch (e) {}
  };

  const loadFromLocal = (convId: string): Message[] => {
      try { return JSON.parse(localStorage.getItem(`${LOCAL_STORAGE_KEY}${currentUser.id}_${convId}`) || '[]'); } catch (e) { return []; }
  };

  const loadConversations = async () => {
    const convs = await mockDb.getConversations(currentUser.id);
    setConversations(convs.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp));
    
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
  };

  const startChatWith = async (targetId: string) => {
    const participants = [currentUser.id, targetId].sort();
    const convId = participants.join(':');
    if (!participantsInfo[targetId]) {
        const u = await mockDb.getUser(targetId);
        if (u) setParticipantsInfo(prev => ({ ...prev, [targetId]: u }));
    }
    setActiveConversationId(convId);
    loadConversations(); 
  };

  const loadMessages = async (convId: string) => {
    const remoteMsgs = await mockDb.getPrivateMessages(convId);
    setMessages(prev => {
        const combined = [...prev];
        remoteMsgs.forEach(rm => { if (!combined.some(m => m.id === rm.id)) combined.push(rm); });
        const sorted = combined.sort((a, b) => a.timestamp - b.timestamp);
        saveToLocal(convId, sorted);
        return sorted;
    });
    await mockDb.markConversationAsRead(currentUser.id, convId);
    loadConversations();
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConversationId) return;
    const targetId = activeConversationId.split(':').find(p => p !== currentUser.id)!;
    try {
        const msg = await mockDb.sendPrivateMessage(currentUser.id, targetId, inputText);
        setMessages(prev => {
            const next = [...prev, msg];
            saveToLocal(activeConversationId, next);
            return next;
        });
        setInputText('');
        loadConversations(); 
    } catch (e) { toast.error("发送失败"); }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
      e.stopPropagation();
      if(confirm("移除会话频率？")) {
          await mockDb.deleteConversation(convId);
          localStorage.removeItem(`${LOCAL_STORAGE_KEY}${currentUser.id}_${convId}`);
          if (activeConversationId === convId) { setActiveConversationId(null); setMessages([]); }
          loadConversations();
      }
  };

  useEffect(() => {
    if (initialTargetId) startChatWith(initialTargetId);
    else loadConversations();
  }, [currentUser.id, initialTargetId]);

  useEffect(() => {
      if (activeConversationId) {
          setMessages(loadFromLocal(activeConversationId));
          loadMessages(activeConversationId);
          intervalRef.current = window.setInterval(() => loadMessages(activeConversationId), 3000);
      }
      return () => clearInterval(intervalRef.current);
  }, [activeConversationId]);

  useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
        if (isInitialLoadRef.current) isInitialLoadRef.current = false;
        else if (messages.length > prevMessagesLengthRef.current) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.senderId !== currentUser.id) playNotificationSound();
        }
        prevMessagesLengthRef.current = messages.length;
    }
  }, [messages, currentUser.id]);

  return (
    <div className="flex-1 flex h-full bg-cyber-900 overflow-hidden">
      {/* 侧边栏 (移动端隐藏逻辑) */}
      <aside className={`${activeConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r border-cyber-700 bg-cyber-800 shrink-0 z-10`}>
          <header className="h-16 flex items-center px-4 border-b border-cyber-700 bg-cyber-900">
              <h2 className="text-white font-black text-xs uppercase tracking-[0.2em] italic">神经网络信道 (Comm-Freq)</h2>
          </header>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              {conversations.length === 0 ? (
                  <div className="p-10 text-center opacity-30 text-xs uppercase font-mono tracking-widest leading-loose">No frequencies detected</div>
              ) : (
                  conversations.map(conv => {
                      const unread = conv.unreadCounts?.[currentUser.id] || 0;
                      const partnerId = conv.id.split(':').find(p => p !== currentUser.id)!;
                      const partner = participantsInfo[partnerId];
                      return (
                          <div 
                            key={conv.id}
                            onClick={() => setActiveConversationId(conv.id)}
                            className={`p-4 border-b border-cyber-700/50 cursor-pointer hover:bg-cyber-700/30 transition-all group relative ${activeConversationId === conv.id ? 'bg-cyber-accent/5' : ''}`}
                          >
                              {activeConversationId === conv.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-accent"></div>}
                              <div className="flex items-center gap-4">
                                  <div className="relative">
                                      <img src={partner?.avatar} className="w-11 h-11 rounded-full border border-cyber-700 bg-black" alt="" />
                                      {partner?.isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-cyber-success rounded-full border-2 border-cyber-800"></span>}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-baseline mb-1">
                                          <h3 className={`font-bold truncate text-sm transition-colors ${unread > 0 ? 'text-cyber-accent' : 'text-gray-200'}`}>{partner?.username || '...'}</h3>
                                          <span className="text-[9px] font-mono text-gray-500">{new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                          <p className={`text-xs truncate ${unread > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                                              {conv.lastMessage.text}
                                          </p>
                                          {unread > 0 && <span className="bg-cyber-accent text-cyber-900 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-2 shadow-[0_0_8px_rgba(0,240,255,0.4)]">{unread}</span>}
                                      </div>
                                  </div>
                              </div>
                              <button onClick={(e) => handleDeleteConversation(e, conv.id)} className="absolute right-2 top-2 p-1 text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                          </div>
                      );
                  })
              )}
          </div>
      </aside>

      {/* 聊天窗口 (移动端全屏) */}
      <section className={`${!activeConversationId ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-cyber-900 relative`}>
          {activeConversationId ? (
              <>
                <header className="h-16 border-b border-cyber-700 flex items-center justify-between px-4 md:px-6 bg-cyber-800/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setActiveConversationId(null)} className="md:hidden p-2 -ml-2 text-cyber-accent hover:bg-cyber-accent/10 rounded-full">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        {(() => {
                            const partnerId = activeConversationId.split(':').find(p => p !== currentUser.id)!;
                            const partner = participantsInfo[partnerId];
                            return (
                                <div className="flex items-center gap-3">
                                    <img src={partner?.avatar} className="w-10 h-10 rounded-full border border-cyber-accent/50" alt="" />
                                    <div>
                                        <div className="font-black text-white text-sm md:text-base tracking-tight">{partner?.username || 'Establishing...'}</div>
                                        <div className="text-[9px] text-cyber-success font-mono uppercase tracking-widest flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-cyber-success animate-pulse"></span>
                                            Encrypted Frequency
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-24 md:pb-6">
                    {messages.map((msg, idx) => {
                        const isMe = msg.senderId === currentUser.id;
                        const isPrevFromSame = idx > 0 && messages[idx-1].senderId === msg.senderId;
                        
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in ${isPrevFromSame ? '-mt-4' : ''}`}>
                                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[75%]`}>
                                    {!isPrevFromSame && (
                                        <div className="flex items-center gap-2 mb-1 px-1">
                                            {!isMe && <span className="text-[10px] text-cyber-accent font-black uppercase italic">{msg.senderName}</span>}
                                            <span className="text-[8px] text-gray-600 font-mono">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    )}
                                    
                                    <div className={`
                                        relative px-4 py-2.5 text-sm break-words whitespace-pre-wrap rounded-2xl shadow-xl border backdrop-blur-sm transition-all hover:scale-[1.01]
                                        ${isMe 
                                            ? 'bg-cyber-accent/10 border-cyber-accent/40 text-cyber-accent rounded-tr-none' 
                                            : 'bg-cyber-800/90 border-cyber-700 text-gray-200 rounded-tl-none'
                                        }
                                    `}>
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    <div ref={chatEndRef} />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-6 bg-cyber-900/90 backdrop-blur-md border-t border-cyber-700">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 md:gap-4 max-w-5xl mx-auto">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-cyber-accent hover:bg-cyber-accent/5 rounded-full transition-all shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                            <input type="file" className="hidden" ref={fileInputRef} />
                        </button>
                        <input 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type encrypted message..."
                            className="flex-1 bg-cyber-800/80 border border-cyber-700 rounded-full px-5 py-2 text-sm text-white focus:border-cyber-accent focus:ring-1 focus:ring-cyber-accent outline-none transition-all font-mono"
                        />
                        <button 
                            type="submit" 
                            disabled={!inputText.trim()} 
                            className={`rounded-full w-10 h-10 flex items-center justify-center shrink-0 transition-all ${inputText.trim() ? 'bg-cyber-accent text-cyber-900 shadow-[0_0_15px_#00f0ff]' : 'bg-cyber-800 text-gray-600'}`}
                        >
                            <svg className="w-5 h-5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
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
                  <p className="text-[10px] mt-2 font-mono uppercase">Select a frequency to begin secure communication</p>
              </div>
          )}
      </section>
    </div>
  );
};
