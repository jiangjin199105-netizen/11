
import React, { useState, useEffect, useRef } from 'react';
import { User, Channel, Item } from './types';
import { mockDb } from './services/mockDb';
import { generateChannelDescription } from './services/geminiService';
import { Button } from './components/Button';
import { MomentsView } from './components/MomentsView';
import { AdminDashboard } from './components/AdminDashboard';
import { UserProfile } from './components/UserProfile';
import { BazaarMap } from './components/BazaarMap';
import { ChatInterface } from './components/ChatInterface';
import { TradeInterface } from './components/TradeInterface';
import { FriendsInterface } from './components/FriendsInterface';
import { playNotificationSound } from './services/audioService';
import { ToastContainer } from './components/Toast';
import { toast } from './services/toastService';

const LOCKOUT_KEY = 'neon_auth_lockout_v1';
const REMEMBER_KEY = 'neon_remember_me_v1';
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 60000;
const KEFU_ID = 'system_kefu_001';

type AppView = 'messages' | 'moments' | 'bazaar' | 'profile' | 'admin' | 'friends' | 'support';

const Icons = {
    Chat: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    Friends: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Moments: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Bazaar: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Admin: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    Support: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Dice: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4V4zm4 4h.01M12 12h.01M16 16h.01M16 8h.01M8 16h.01" /></svg>,
};

const RANDOM_NICKNAMES = {
    prefixes: ['电磁', '虚空', '霓虹', '幽灵', '算法', '极客', '赛博', '零度', '暗影', '数据', '量子', '矩阵', '机械', '极光', '深度'],
    suffixes: ['舞者', '浪人', '核心', '节点', '漫游者', '骑士', '脉冲', '协议', '猎人', '黑客', '幽灵', '重构者', '先锋', '影子', '构造体']
};

const MainLogo = ({ className = "" }: { className?: string }) => (
    <div className={`flex flex-col items-center select-none ${className}`}>
        <div className="relative">
            <span className="text-4xl md:text-5xl font-black text-white tracking-[0.2em] drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                霓虹
            </span>
            <span className="absolute inset-0 text-cyber-accent blur-[2px] opacity-40 -z-10 animate-pulse">霓虹</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
            <div className="h-[2px] w-8 bg-gradient-to-r from-transparent to-cyber-accent"></div>
            <span className="text-3xl md:text-4xl font-black text-cyber-accent italic tracking-tighter drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]">
                集市
            </span>
            <div className="h-[2px] w-8 bg-gradient-to-l from-transparent to-cyber-accent"></div>
        </div>
        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-[0.4em] mt-3 opacity-60">NEON BAZAAR V1.0</span>
    </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginAccount, setLoginAccount] = useState(''); 
  const [registerDisplayName, setRegisterDisplayName] = useState(''); 
  const [loginPass, setLoginPass] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('bazaar');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  
  const [profileTarget, setProfileTarget] = useState<User | null>(null);
  const [chatTargetId, setChatTargetId] = useState<string | undefined>(undefined);
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
        try {
            const { account, pass } = JSON.parse(saved);
            setLoginAccount(account || '');
            setLoginPass(pass || '');
            setRememberMe(true);
        } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
        const count = await mockDb.getTotalUnreadCount(user.id);
        setUnreadCount(count);
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const checkLockout = () => {
      if (!loginAccount || authMode !== 'login') {
        setLockoutTimeLeft(0);
        return;
      }
      const lockData = JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}');
      const accountData = lockData[loginAccount.toLowerCase()];
      if (accountData && accountData.lockedUntil > Date.now()) {
        const remaining = Math.ceil((accountData.lockedUntil - Date.now()) / 1000);
        setLockoutTimeLeft(remaining);
      } else {
        setLockoutTimeLeft(0);
      }
    };
    checkLockout();
    const timer = setInterval(checkLockout, 1000);
    return () => clearInterval(timer);
  }, [loginAccount, authMode]);

  const generateRandomNickname = () => {
      const p = RANDOM_NICKNAMES.prefixes[Math.floor(Math.random() * RANDOM_NICKNAMES.prefixes.length)];
      const s = RANDOM_NICKNAMES.suffixes[Math.floor(Math.random() * RANDOM_NICKNAMES.suffixes.length)];
      setRegisterDisplayName(`${p}${s}`);
      toast.info("随机昵称已生成");
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginAccount.trim() || !loginPass.trim()) return;

    if (authMode === 'login' && lockoutTimeLeft > 0) {
      toast.error(`账号锁定中，请等待 ${lockoutTimeLeft} 秒`);
      return;
    }

    setIsLoading(true);
    try {
        if (authMode === 'login') {
            const res = await mockDb.login(loginAccount, loginPass);
            if (res.error) {
                setLoginError(res.error);
                toast.error(res.error);
            } else if (res.user) {
                if (rememberMe) {
                    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ account: loginAccount, pass: loginPass }));
                } else {
                    localStorage.removeItem(REMEMBER_KEY);
                }

                setUser(res.user);
                setCurrentView('bazaar'); 
                toast.success(`接入成功: ${res.user.username}`);
            }
        } else {
            const res = await mockDb.register(loginAccount, registerDisplayName, loginPass); 
            if (res.error) {
                setLoginError(res.error);
                toast.error(res.error);
            } else {
                toast.success('档案初始化完成');
                setUser(res.user!);
                setCurrentView('bazaar');
            }
        }
    } catch (e: any) {
        setLoginError("系统链路故障");
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveChannel(null);
    setCurrentView('bazaar');
    toast.info('连接已安全切断');
  };

  const handleUpdateUser = (updatedUser: User) => {
      setUser(updatedUser);
      mockDb.updateUser(updatedUser);
  };

  const handleOpenProfile = (target: User) => setProfileTarget(target);
  const handleOpenChat = (targetUserId: string) => {
      setChatTargetId(targetUserId);
      setCurrentView('messages');
  };

  const handleContactSupport = () => {
      setChatTargetId(KEFU_ID);
      setCurrentView('messages');
      toast.info("正在建立官方客服链路...");
  };

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-cyber-900 p-4">
        <ToastContainer />
        <div className="max-w-md w-full p-8 bg-cyber-800 border border-cyber-accent/30 rounded-xl shadow-[0_0_40px_rgba(0,240,255,0.1)] relative animate-fade-in">
          <MainLogo className="mb-10" />
          <div className="flex mb-8 bg-cyber-900/50 p-1 rounded-lg">
                <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${authMode === 'login' ? 'bg-cyber-accent text-cyber-900 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>登录</button>
                <button onClick={() => setAuthMode('register')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${authMode === 'register' ? 'bg-cyber-accent text-cyber-900 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>注册</button>
          </div>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
                <input type="text" value={loginAccount} onChange={e => setLoginAccount(e.target.value)} className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-3 text-white focus:border-cyber-accent outline-none font-mono text-sm transition-colors" placeholder="账号标识 (Account ID)" required />
                
                {authMode === 'register' && (
                  <div className="relative group">
                    <input type="text" value={registerDisplayName} onChange={e => setRegisterDisplayName(e.target.value)} className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-3 pr-12 text-white focus:border-cyber-accent outline-none font-mono text-sm" placeholder="显示昵称 (Handle)" required />
                    <button 
                      type="button" 
                      onClick={generateRandomNickname}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-cyber-accent/50 hover:text-cyber-accent transition-colors"
                      title="生成随机昵称"
                    >
                      <Icons.Dice />
                    </button>
                  </div>
                )}

                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full bg-cyber-900 border border-cyber-700 rounded-lg p-3 text-white focus:border-cyber-accent outline-none font-mono text-sm" placeholder="访问密钥 (Passcode)" required />
                
                {authMode === 'login' && (
                    <label className="flex items-center gap-2 cursor-pointer group mt-2">
                        <div className="relative flex items-center">
                            <input 
                                type="checkbox" 
                                checked={rememberMe} 
                                onChange={e => setRememberMe(e.target.checked)} 
                                className="peer hidden"
                            />
                            <div className="w-4 h-4 border border-cyber-700 rounded bg-cyber-900 peer-checked:bg-cyber-accent peer-checked:border-cyber-accent transition-all"></div>
                            <svg className="absolute w-3 h-3 text-cyber-900 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 group-hover:text-gray-300 transition-colors tracking-widest">记住访问凭据 (Remember Me)</span>
                    </label>
                )}

                <Button type="submit" className="w-full h-12 mt-4" loading={isLoading}>
                    {authMode === 'login' ? '初始化接入' : '建立档案'}
                </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-black text-gray-100 font-sans safe-area-inset">
      <ToastContainer />
      
      <nav className="fixed bottom-0 left-0 right-0 h-16 md:h-full md:w-20 md:static bg-cyber-800/90 backdrop-blur-md border-t md:border-t-0 md:border-r border-cyber-700 flex md:flex-col justify-between md:justify-start md:pt-10 items-center z-[100] px-2 md:px-0">
          <div className="hidden md:flex flex-col items-center mb-10">
              <span className="text-cyber-accent font-black text-xs italic tracking-tighter">霓虹</span>
              <span className="text-white font-black text-[10px] uppercase">集市</span>
          </div>

          <NavButton active={currentView === 'messages'} onClick={() => { setCurrentView('messages'); setChatTargetId(undefined); }} icon={<Icons.Chat />} label="消息" badge={unreadCount} />
          <NavButton active={currentView === 'friends'} onClick={() => setCurrentView('friends')} icon={<Icons.Friends />} label="好友" />
          
          <div className="relative -top-5 md:top-0 md:my-6 scale-110 md:scale-100">
             <button onClick={() => setCurrentView('bazaar')} className={`w-14 h-14 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-xl ${currentView === 'bazaar' ? 'bg-cyber-accent text-cyber-900 border-white rotate-12' : 'bg-cyber-900 text-cyber-accent border-cyber-accent hover:rotate-6'}`}><Icons.Bazaar /></button>
          </div>
          
          <NavButton active={currentView === 'moments'} onClick={() => setCurrentView('moments')} icon={<Icons.Moments />} label="动态" />
          <NavButton active={false} onClick={handleContactSupport} icon={<Icons.Support />} label="客服" />
          <NavButton active={currentView === 'profile'} onClick={() => setCurrentView('profile')} icon={<Icons.User />} label="档案" />
          
          {(user.isAdmin || user.accountName === 'admin') && (
            <NavButton active={currentView === 'admin'} onClick={() => setCurrentView('admin')} icon={<Icons.Admin />} label="管理" />
          )}
      </nav>

      <main className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0 relative">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #00f0ff 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        
        <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
            {currentView === 'messages' && <ChatInterface currentUser={user} initialTargetId={chatTargetId} />}
            {currentView === 'moments' && <MomentsView user={user} />}
            {currentView === 'bazaar' && (
                activeChannel ? (
                    <BazaarMap 
                      currentUser={user} 
                      activeChannel={activeChannel} 
                      onUserUpdate={handleUpdateUser} 
                      onSelectUser={handleOpenProfile} 
                      onLeave={() => setActiveChannel(null)} 
                    />
                ) : (
                    <BazaarLobby user={user} onJoinChannel={setActiveChannel} />
                )
            )}
            {currentView === 'friends' && <FriendsInterface currentUser={user} onUpdateCurrentUser={handleUpdateUser} onOpenChat={handleOpenChat} onOpenProfile={handleOpenProfile} />}
            {currentView === 'admin' && <AdminDashboard />}
            {currentView === 'profile' && (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className="w-24 h-24 mb-6 rounded-full border-4 border-cyber-accent p-1 shadow-[0_0_30px_rgba(0,240,255,0.3)]">
                        <img src={user.avatar} className="w-full h-full rounded-full bg-black" alt="" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{user.username}</h2>
                    <p className="text-sm text-cyber-accent font-mono mb-10">ACCESS LEVEL: {user.isAdmin ? 'ROOT_USER' : 'CIVILIAN'}</p>
                    
                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-12">
                        <div className="bg-cyber-800/50 p-4 rounded-xl border border-cyber-700">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Credits</p>
                            <p className="text-xl font-bold text-yellow-400 font-mono">{user.credits}</p>
                        </div>
                        <div className="bg-cyber-800/50 p-4 rounded-xl border border-cyber-700">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Reputation</p>
                            <p className="text-xl font-bold text-cyber-success font-mono">{user.merchantStats.reputation}%</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <Button onClick={() => handleOpenProfile(user)} variant="secondary">查看完整档案</Button>
                        <Button onClick={handleLogout} variant="ghost" className="text-red-500 hover:bg-red-500/10">断开频率连接</Button>
                    </div>
                </div>
            )}
        </div>
      </main>

      {profileTarget && (
          <UserProfile currentUser={user} targetUser={profileTarget} onClose={() => setProfileTarget(null)} onUpdateCurrentUser={handleUpdateUser} onOpenChat={handleOpenChat} onStartP2PTrade={(tradeId) => setActiveTradeId(tradeId)} />
      )}
      {activeTradeId && <TradeInterface user={user} tradeId={activeTradeId} onClose={() => setActiveTradeId(null)} onTradeComplete={() => {}} />}
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) => (
    <button onClick={onClick} className={`relative flex flex-col items-center justify-center gap-1 w-full md:gap-1.5 md:h-16 md:w-full transition-all ${active ? 'text-cyber-accent' : 'text-gray-500 hover:text-gray-300'}`}>
        <div className={`transition-all duration-300 ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' : ''}`}>
            {icon}
            {badge && badge > 0 ? <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyber-danger text-[9px] font-bold text-white shadow-[0_0_8px_rgba(255,42,109,0.5)] animate-pulse">{badge > 9 ? '9+' : badge}</span> : null}
        </div>
        <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
        {active && <div className="absolute bottom-0 md:left-0 md:top-0 md:bottom-0 md:w-1 w-full h-1 md:h-full bg-cyber-accent shadow-[0_0_15px_#00f0ff]"></div>}
    </button>
);

const BazaarLobby = ({ user, onJoinChannel }: { user: User, onJoinChannel: (c: Channel) => void }) => {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');

    useEffect(() => { load(); }, [search]);

    const load = async () => {
        setLoading(true);
        const list = await mockDb.getChannels(search);
        setChannels(list);
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setLoading(true);
        const desc = await generateChannelDescription(newName);
        const newChan = await mockDb.createChannel({
            name: newName,
            description: desc,
            hostId: user.id,
            isPrivate: false,
            playerCount: 1,
            maxPlayers: 50,
            tags: ['New']
        });
        onJoinChannel(newChan);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-cyber-900 p-4 md:p-8 overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto w-full">
                <header className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-10">
                    <div className="flex-1">
                        <MainLogo className="!items-start mb-4" />
                        <div className="flex items-center gap-2 mt-4">
                            <span className="w-2 h-2 rounded-full bg-cyber-success animate-pulse"></span>
                            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest italic">Global Frequencies Detected / 信号广播中...</span>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <input 
                                type="text" 
                                className="w-full bg-cyber-800 border border-cyber-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-cyber-accent outline-none transition-all"
                                placeholder="查找信号..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <Button onClick={() => setIsCreating(true)} className="whitespace-nowrap">建立频道</Button>
                    </div>
                </header>

                {isCreating && (
                    <div className="mb-10 p-6 bg-cyber-800 border border-cyber-accent/40 rounded-xl animate-fade-in-up relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-accent/5 -rotate-45 translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform"></div>
                        <h3 className="text-white font-bold mb-4 uppercase text-sm tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-cyber-accent"></span>
                            同步新频率 (Sync New Freq)
                        </h3>
                        <div className="flex flex-col md:flex-row gap-4">
                            <input 
                                type="text" 
                                className="flex-1 bg-cyber-900 border border-cyber-700 rounded-lg p-3 text-white focus:border-cyber-accent outline-none font-mono"
                                placeholder="输入频道名称..."
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Button onClick={handleCreate} loading={loading} className="flex-1 md:flex-none">初始化</Button>
                                <Button variant="ghost" onClick={() => setIsCreating(false)} className="flex-1 md:flex-none">取消</Button>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                        <div className="w-12 h-12 border-4 border-cyber-accent border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-cyber-accent font-mono animate-pulse uppercase tracking-[0.2em]">Decrypting Available Signals...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-20">
                        {channels.length === 0 ? (
                            <div className="col-span-full text-center py-20 border-2 border-dashed border-cyber-800 rounded-2xl">
                                <p className="text-gray-600 font-mono text-xs uppercase tracking-widest italic">No clear frequencies detected in this range</p>
                            </div>
                        ) : (
                            channels.map(c => (
                                <div key={c.id} className="bg-cyber-800 border border-cyber-700/50 p-6 rounded-2xl hover:border-cyber-accent hover:shadow-[0_0_20px_rgba(0,240,255,0.05)] transition-all cursor-pointer group flex flex-col h-full" onClick={() => onJoinChannel(c)}>
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-xl font-black text-white group-hover:text-cyber-accent transition-colors">#{c.name}</h4>
                                        <span className="bg-cyber-900 border border-cyber-accent/30 text-cyber-accent text-[9px] font-mono px-2 py-1 rounded-md uppercase">
                                            {c.playerCount} / {c.maxPlayers}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-6 flex-1 italic">"{c.description}"</p>
                                    <div className="flex items-center justify-between border-t border-cyber-700 pt-4 mt-auto">
                                        <div className="flex gap-1.5 overflow-hidden">
                                            {c.tags.map(t => <span key={t} className="text-[8px] bg-cyber-900 text-gray-400 px-2 py-0.5 rounded uppercase font-mono border border-cyber-800">#{t}</span>)}
                                        </div>
                                        <svg className="w-5 h-5 text-cyber-accent opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
