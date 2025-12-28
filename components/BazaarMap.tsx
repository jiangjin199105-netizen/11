
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Channel, BazaarPost } from '../types';
import { mockDb } from '../services/mockDb';
import { Button } from './Button';
import { toast } from '../services/toastService';

interface BazaarMapProps {
  currentUser: User;
  activeChannel: Channel;
  onUserUpdate: (user: User) => void;
  onSelectUser: (user: User) => void;
  onLeave: () => void;
}

const DEFAULT_BROADCAST = "摊位固定费用: 100 CR / 24H • 频道聊天记录自动清理周期: 30 MIN";

export const BazaarMap: React.FC<BazaarMapProps> = ({ currentUser, activeChannel, onUserUpdate, onSelectUser, onLeave }) => {
  const [otherParticipants, setOtherParticipants] = useState<User[]>([]);
  const [channelPosts, setChannelPosts] = useState<BazaarPost[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState<string>(activeChannel.broadcastMessage || DEFAULT_BROADCAST);
  
  const [isPosting, setIsPosting] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ id: string, isAdmin: boolean } | null>(null);
  
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalFileInputRef = useRef<HTMLInputElement>(null);

  // 终端与名录状态
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isStallListOpen, setIsStallListOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // 优化后的初始位置：靠左
  const [terminalPos, setTerminalPos] = useState({ 
    x: window.innerWidth < 768 ? 10 : 20, 
    y: window.innerWidth < 768 ? 100 : 150 
  });
  
  // 优化后的初始大小：手机端更窄更高，适应垂直操作
  const [terminalSize, setTerminalSize] = useState({ 
    w: window.innerWidth < 768 ? Math.min(window.innerWidth - 20, 300) : 320, 
    h: window.innerWidth < 768 ? 320 : 260 
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const myPost = channelPosts.find(p => p.userId === currentUser.id);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    loadData();
    loadMessages();
    const interval = setInterval(() => { loadData(); loadMessages(); }, 4000); 
    return () => {
        window.removeEventListener('resize', handleResize);
        clearInterval(interval);
    };
  }, [activeChannel.id]);

  useEffect(() => {
    if (isTerminalOpen) terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTerminalOpen]);

  const loadData = async () => {
    const users = await mockDb.getBazaarParticipants(activeChannel.id);
    setOtherParticipants(users.filter(u => u.id !== currentUser.id));
    const posts = await mockDb.getChannelPosts(activeChannel.id);
    setChannelPosts(posts.sort((a, b) => a.timestamp - b.timestamp));
    const channels = await mockDb.getChannels();
    const thisChannel = channels.find(c => c.id === activeChannel.id);
    setBroadcastMessage(thisChannel?.broadcastMessage || DEFAULT_BROADCAST);
  };

  const loadMessages = async () => {
      const msgs = await mockDb.getChannelMessages(activeChannel.id);
      setChatMessages(msgs);
  };

  const handleSendChannelMsg = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!chatInput.trim()) return;
      const text = chatInput.trim();
      setChatInput('');
      await mockDb.sendChannelMessage(activeChannel.id, currentUser, text);
      loadMessages();
  };

  const handleTerminalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 500) { toast.error("信号包过载 (限制 500KB)"); return; }

      const reader = new FileReader();
      reader.onload = async (ev) => {
          await mockDb.sendChannelMessage(activeChannel.id, currentUser, "[加密图传]", ev.target?.result as string);
          loadMessages();
      };
      reader.readAsDataURL(file);
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isResizing || isPosting || showConfirmDelete || isStallListOpen) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.max(5, Math.min(95, x));
    const clampedY = Math.max(10, Math.min(90, y));

    onUserUpdate({ ...currentUser, position: { x: clampedX, y: clampedY } });
    if (myPost) await mockDb.updateBazaarPostPosition(currentUser.id, activeChannel.id, { x: clampedX, y: clampedY });
    else await mockDb.updateUserPosition(currentUser.id, clampedX, clampedY);
  };

  const handlePublishPost = async () => {
      if (!postContent.trim()) return;
      if (isEditing && myPost) {
          const res = await mockDb.publishBazaarPost(currentUser.id, activeChannel.id, postContent);
          if (res.success) { toast.success("广播信号已更新"); setIsPosting(false); loadData(); }
          return;
      }
      if (currentUser.credits < 100) { toast.error("信用点不足 (100 CR)"); return; }
      const res = await mockDb.publishBazaarPost(currentUser.id, activeChannel.id, postContent);
      if (res.success) { onUserUpdate(res.user!); setIsPosting(false); setPostContent(''); loadData(); toast.success("摊位上线！-100 CR"); }
  };

  const handleExecuteDelete = async () => {
      if (!showConfirmDelete) return;
      await mockDb.deleteBazaarPost(showConfirmDelete.id);
      setShowConfirmDelete(null);
      loadData();
      toast.info("摊位已下线");
  };

  // 改进拖拽逻辑：支持鼠标和触摸
  const startDragging = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setIsDragging(true);
    dragStart.current = { x: clientX - terminalPos.x, y: clientY - terminalPos.y };
  };

  const startResizing = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsResizing(true);
    dragStart.current = { x: clientX, y: clientY };
  };

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (isDragging) {
      setTerminalPos({ 
        x: Math.max(0, Math.min(window.innerWidth - 40, clientX - dragStart.current.x)), 
        y: Math.max(0, Math.min(window.innerHeight - 80, clientY - dragStart.current.y)) 
      });
    }
    if (isResizing) {
      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;
      setTerminalSize(prev => ({ 
        w: Math.max(isMobile ? 180 : 240, Math.min(window.innerWidth - terminalPos.x - 10, prev.w + dx)), 
        h: Math.max(150, Math.min(window.innerHeight - terminalPos.y - 10, prev.h + dy)) 
      }));
      dragStart.current = { x: clientX, y: clientY };
    }
  }, [isDragging, isResizing, terminalPos, isMobile]);

  const handleEnd = useCallback(() => { 
    setIsDragging(false); 
    setIsResizing(false); 
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => { 
      window.removeEventListener('mousemove', handleMove); 
      window.removeEventListener('mouseup', handleEnd); 
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, isResizing, handleMove, handleEnd]);

  return (
    <div className="flex-1 flex flex-col h-full bg-cyber-900 overflow-hidden relative select-none">
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 z-30 flex flex-col pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md border-b border-cyber-accent/30 p-3 md:p-4 flex justify-between items-center pointer-events-auto">
                <div className="flex items-center gap-3">
                    <button onClick={onLeave} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-cyber-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                            {activeChannel.name}
                            <span className="text-[8px] bg-cyber-accent/10 border border-cyber-accent/50 text-cyber-accent px-1.5 rounded-sm animate-pulse">LIVE</span>
                        </h2>
                        <p className="text-[9px] font-mono text-gray-500 uppercase">Credits: <span className="text-yellow-400">{currentUser.credits}</span> | Region: CN-NEON-1</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsStallListOpen(!isStallListOpen)}
                        className={`p-2 rounded border transition-all pointer-events-auto flex items-center gap-2 ${isStallListOpen ? 'bg-cyber-accent text-cyber-900 border-white' : 'bg-cyber-800 border-cyber-700 text-gray-500 hover:text-cyber-accent'}`}
                        title="摊位名录"
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        <span className="hidden md:block text-[10px] font-black uppercase">摊位名录</span>
                    </button>
                    <button 
                        onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                        className={`p-2 rounded border transition-all pointer-events-auto ${isTerminalOpen ? 'bg-cyber-accent/20 border-cyber-accent text-cyber-accent' : 'bg-cyber-800 border-cyber-700 text-gray-500'}`}
                        title="终端"
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    </button>
                </div>
            </div>
            
            <div className="bg-cyber-warning/10 border-b border-cyber-warning/20 h-5 md:h-6 flex items-center overflow-hidden pointer-events-auto">
                <div className="whitespace-nowrap animate-[marquee_25s_linear_infinite] flex items-center gap-10">
                    <span className="text-cyber-warning font-mono text-[8px] md:text-[9px] font-bold uppercase tracking-[0.1em]">{broadcastMessage}</span>
                    <span className="text-cyber-warning font-mono text-[8px] md:text-[9px] font-bold uppercase tracking-[0.1em]">{broadcastMessage}</span>
                </div>
            </div>
        </div>

        {/* 摊位名录弹出层 */}
        {isStallListOpen && (
            <div className={`absolute z-50 flex flex-col bg-cyber-800/95 backdrop-blur-xl border border-cyber-accent/30 shadow-2xl transition-all duration-300 animate-fade-in-right ${isMobile ? 'inset-0 top-[84px] rounded-t-3xl' : 'right-4 top-24 bottom-24 w-80 rounded-2xl'}`}>
                <div className="p-4 border-b border-cyber-accent/20 flex justify-between items-center">
                    <h3 className="text-white font-black uppercase text-xs tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-cyber-accent"></span>
                        摊位信号频率 (List)
                    </h3>
                    <button onClick={() => setIsStallListOpen(false)} className="text-gray-500 hover:text-white">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {channelPosts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                            <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={1} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                            <p className="text-[10px] font-mono uppercase">No Broadcasts Detected</p>
                        </div>
                    ) : (
                        channelPosts.map((post, idx) => (
                            <div 
                                key={post.id} 
                                onClick={() => { onSelectUser({ id: post.userId, username: post.username, avatar: post.userAvatar } as any); if(isMobile) setIsStallListOpen(false); }}
                                className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer group ${post.userId === currentUser.id ? 'bg-cyber-accent/10 border-cyber-accent' : 'bg-cyber-900 border-cyber-700 hover:border-cyber-accent/50 hover:bg-cyber-800'}`}
                            >
                                <span className="text-[10px] font-mono text-gray-500">#{idx + 1}</span>
                                <img src={post.userAvatar} className={`w-10 h-10 rounded-full border-2 ${post.userId === currentUser.id ? 'border-cyber-accent' : 'border-gray-700 group-hover:border-cyber-accent/50'}`} alt="" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-black text-white truncate">{post.username}</div>
                                    <div className={`text-[11px] font-bold truncate mt-0.5 ${post.userId === currentUser.id ? 'text-cyber-accent' : 'text-gray-300'}`}>"{post.content}"</div>
                                </div>
                                <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-cyber-900 border border-cyber-700 group-hover:border-cyber-accent group-hover:text-cyber-accent transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}

        {/* Interactive Map Area */}
        <div 
            ref={containerRef} 
            className="flex-1 relative cursor-crosshair overflow-hidden bg-black" 
            onClick={handleMapClick}
            style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #151520, #000)' }}
        >
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#00f0ff 1px, transparent 1px), linear-gradient(90deg, #00f0ff 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
            
            {/* Posts / Shops */}
            {channelPosts.map(post => {
                const isMyPost = post.userId === currentUser.id;
                return (
                    <div 
                        key={post.id}
                        className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-[calc(100%+8px)] z-10 transition-all duration-500"
                        style={{ left: `${post.position.x}%`, top: `${post.position.y}%` }}
                        onClick={(e) => { e.stopPropagation(); onSelectUser({ id: post.userId, username: post.username, avatar: post.userAvatar } as any); }}
                    >
                        <div className={`mb-1.5 px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)] border whitespace-nowrap animate-bounce-slow max-w-[120px] overflow-hidden truncate ${isMyPost ? 'bg-cyber-accent text-black border-white ring-2 ring-white/10' : 'bg-yellow-400 text-black border-yellow-200'}`}>
                            {post.content}
                            {(isMyPost || currentUser.isAdmin) && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowConfirmDelete({ id: post.id, isAdmin: !isMyPost && !!currentUser.isAdmin }); }} 
                                    className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1 border border-white/20 hover:scale-110 active:scale-90 transition-transform shadow-lg"
                                >
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                        <div className="relative group">
                            <div className={`absolute -inset-1 rounded-full blur-md opacity-60 group-hover:opacity-100 transition-opacity ${isMyPost ? 'bg-cyber-accent' : 'bg-yellow-400'}`}></div>
                            <img src={post.userAvatar} className="relative w-8 h-8 md:w-12 md:h-12 rounded-full border-2 border-white/30 object-cover" />
                        </div>
                    </div>
                );
            })}

            {/* Avatars */}
            {otherParticipants.map(user => (
                <div key={user.id} className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-full pointer-events-auto" style={{ left: `${user.position?.x}%`, top: `${user.position?.y}%`, transition: 'all 2s linear' }} onClick={(e) => { e.stopPropagation(); onSelectUser(user); }}>
                    <div className="text-[8px] mb-0.5 px-1.5 py-0.5 rounded-full bg-black/60 text-gray-400 border border-white/10 backdrop-blur-sm truncate max-w-[60px]">{user.username}</div>
                    <img src={user.avatar} className="w-6 h-6 md:w-10 md:h-10 rounded-full border border-gray-700/50 shadow-md" />
                </div>
            ))}

            {/* Current Player */}
            <div className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-full z-20 pointer-events-none" style={{ left: `${currentUser.position.x}%`, top: `${currentUser.position.y}%`, transition: 'all 0.3s ease-out' }}>
                <div className="text-[8px] mb-1 px-2 py-0.5 rounded-full bg-cyber-accent text-cyber-900 font-bold uppercase border border-white/50 shadow-[0_0_10px_#00f0ff]">Me</div>
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border-2 border-cyber-accent shadow-[0_0_20px_#00f0ff] overflow-hidden p-0.5 bg-black">
                    <img src={currentUser.avatar} className="w-full h-full rounded-full" />
                </div>
            </div>
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
            <div className="w-full max-w-xs flex flex-col items-center gap-3 pointer-events-auto">
                {isPosting ? (
                    <div className="w-full bg-cyber-800/95 backdrop-blur-xl border border-cyber-accent/50 rounded-2xl p-4 shadow-2xl animate-fade-in-up">
                        <h3 className="text-white text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                             <span className="w-1.5 h-3 bg-cyber-accent"></span>
                             {isEditing ? '调整广播信号' : '开启交易频率 (100 CR)'}
                        </h3>
                        <textarea className="w-full bg-cyber-900 border border-cyber-700 rounded-xl p-3 text-white text-xs mb-3 outline-none focus:border-cyber-accent transition-colors" rows={2} maxLength={20} placeholder="广告内容... (限20字)" value={postContent} onChange={e => setPostContent(e.target.value)} />
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="flex-1" onClick={() => { setIsPosting(false); setIsEditing(false); }}>返回</Button>
                            <Button size="sm" className="flex-1" onClick={handlePublishPost}>{isEditing ? '更新' : '确认支付'}</Button>
                        </div>
                    </div>
                ) : (
                    myPost ? (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="bg-black/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-cyber-accent/40 text-[9px] text-cyber-accent font-mono uppercase flex items-center justify-center gap-2 shadow-xl">
                                <span className="w-1.5 h-1.5 bg-cyber-accent rounded-full animate-pulse shadow-[0_0_8px_#00f0ff]"></span>
                                全局信号收发中...
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setIsPosting(true); setIsEditing(true); setPostContent(myPost.content); }}
                                    className="flex-1 bg-cyber-accent text-cyber-900 font-black px-4 py-3 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-tighter">
                                    编辑摊位
                                </button>
                                <button onClick={() => setShowConfirmDelete({ id: myPost.id, isAdmin: false })}
                                    className="flex-1 bg-cyber-danger text-white font-black px-4 py-3 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-tighter">
                                    撤回信号
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setIsPosting(true)}
                            className="bg-cyber-accent text-cyber-900 font-black px-10 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 uppercase tracking-tighter text-sm">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            上线集市 (100 CR)
                        </button>
                    )
                )}
            </div>
        </div>

        {/* Terminal Window - 优化手机端拖拽与初始位置 */}
        {isTerminalOpen && (
            <div 
              className={`fixed z-50 bg-black/90 border border-cyber-accent/30 flex flex-col backdrop-blur-xl shadow-2xl transition-all overflow-hidden rounded-2xl`}
              style={{ 
                left: `${terminalPos.x}px`, 
                top: `${terminalPos.y}px`, 
                width: `${terminalSize.w}px`, 
                height: `${terminalSize.h}px`,
                touchAction: 'none' // 防止触摸滚动干扰拖拽
              }}
            >
                 {/* Terminal Header - 拖拽区域，增加触摸支持 */}
                 <div 
                    className="p-3 border-b border-cyber-accent/20 bg-cyber-accent/5 flex justify-between items-center cursor-move select-none" 
                    onMouseDown={startDragging}
                    onTouchStart={startDragging}
                 >
                     <div className="flex items-center gap-2 pointer-events-none">
                         <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                         <span className="text-[10px] text-cyber-accent font-black uppercase tracking-[0.2em] font-mono">Terminal Feed</span>
                     </div>
                     <div className="flex gap-2">
                         <button onClick={() => setIsTerminalOpen(false)} className="text-gray-500 hover:text-white transition-colors p-1">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                     </div>
                 </div>
                 
                 {/* Terminal Content */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar font-mono text-[10px] md:text-[11px] leading-relaxed">
                    {chatMessages.map(m => (
                        <div key={m.id} className="animate-fade-in group">
                            <div className="flex items-center gap-2 opacity-60">
                                <span className="text-[9px] text-cyber-accent font-bold">[{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}]</span>
                                <span className="font-black text-gray-300 uppercase">{m.senderName}:</span>
                            </div>
                            <div className="mt-1 ml-4 pl-3 border-l-2 border-cyber-700/50 group-hover:border-cyber-accent transition-colors">
                                {m.imageContent && <img src={m.imageContent} className="max-w-[150px] rounded-lg border border-cyber-accent/30 mb-2 shadow-xl" />}
                                <span className="text-gray-100 break-words">{m.text}</span>
                            </div>
                        </div>
                    ))}
                    <div ref={terminalEndRef} />
                 </div>

                 {/* Terminal Input */}
                 <form onSubmit={handleSendChannelMsg} className="p-3 border-t border-cyber-accent/20 flex gap-2 bg-black/40 items-center">
                    <button type="button" onClick={() => terminalFileInputRef.current?.click()} className="text-gray-500 hover:text-cyber-accent p-1.5 transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <input type="file" accept="image/*" className="hidden" ref={terminalFileInputRef} onChange={handleTerminalImageUpload} />
                    </button>
                    <input type="text" className="flex-1 bg-cyber-900/50 border border-cyber-700 rounded-full px-4 py-2 text-[10px] text-white focus:border-cyber-accent outline-none font-mono" placeholder="Input..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
                    <button className="text-cyber-accent hover:scale-110 active:scale-95 transition-all p-1"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" /></svg></button>
                 </form>
                 
                 {/* Resize Handle - 增加触摸支持 */}
                 <div 
                    className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-2 group" 
                    onMouseDown={startResizing}
                    onTouchStart={startResizing}
                 >
                     <div className="w-3 h-3 border-r-2 border-b-2 border-cyber-accent/30 group-hover:border-cyber-accent transition-colors"></div>
                 </div>
            </div>
        )}

        {/* Delete Confirmation */}
        {showConfirmDelete && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-fade-in">
                <div className="bg-cyber-800 border border-cyber-danger p-6 rounded-2xl max-w-xs w-full shadow-2xl animate-fade-in-up">
                    <h3 className="text-white font-black uppercase text-sm mb-4 flex items-center gap-2">
                        <span className="w-2 h-5 bg-cyber-danger"></span>
                        警告 (Warning)
                    </h3>
                    <p className="text-xs text-gray-400 mb-6 leading-relaxed">确定要关闭此摊位的频率连接吗？</p>
                    <div className="flex gap-3">
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => setShowConfirmDelete(null)}>取消</Button>
                        <Button size="sm" variant="danger" className="flex-1" onClick={handleExecuteDelete}>确认撤回</Button>
                    </div>
                </div>
            </div>
        )}

        <style>{`
            @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
            @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
            .animate-bounce-slow { animation: bounce-slow 3s infinite ease-in-out; }
            .animate-fade-in-right { animation: fadeInRight 0.3s ease-out; }
            @keyframes fadeInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
            .safe-area-inset { padding-bottom: env(safe-area-inset-bottom); }
        `}</style>
    </div>
  );
};
