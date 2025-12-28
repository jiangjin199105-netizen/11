
import React, { useState, useEffect } from 'react';
import { User, Item, TradeReview } from '../types';
import { Button } from './Button';
import { mockDb } from '../services/mockDb';
import { toast } from '../services/toastService';

interface UserProfileProps {
  currentUser: User;
  targetUser: User;
  onClose: () => void;
  onUpdateCurrentUser: (user: User) => void;
  onOpenChat?: (targetUserId: string) => void;
  onStartAiTrade?: () => void;
  onStartP2PTrade?: (tradeId: string) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ currentUser, targetUser, onClose, onUpdateCurrentUser, onOpenChat, onStartAiTrade, onStartP2PTrade }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'inventory' | 'reviews'>('info');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  
  const isMe = currentUser.id === targetUser.id;

  useEffect(() => {
      setIsFriend(currentUser.friends.includes(targetUser.id));
  }, [targetUser, currentUser]);

  const handleAddFriend = async () => {
    setIsProcessing(true);
    try {
        const updated = await mockDb.addFriendDirectly(currentUser.id, targetUser.id);
        onUpdateCurrentUser(updated);
        toast.success(`已与 ${targetUser.username} 建立加密链接！`);
    } catch (e) { toast.error("建立链接失败"); }
    setIsProcessing(false);
  };

  const handleRequestTrade = async () => {
      setIsProcessing(true);
      try {
          const tradeId = await mockDb.createTradeSession(currentUser.id, targetUser.id);
          await mockDb.sendPrivateMessage(currentUser.id, targetUser.id, `[系统] ${currentUser.username} 发起了交易请求。`, undefined, { type: 'trade_invite', tradeId });
          toast.success("交易请求已发送");
          if (onOpenChat) onOpenChat(targetUser.id);
          if (onStartP2PTrade) onStartP2PTrade(tradeId);
          onClose();
      } catch (e) { toast.error("发起失败"); }
      setIsProcessing(false);
  };

  const getLevelProgress = () => {
      const exp = targetUser.tradeExp || 0;
      const level = targetUser.merchantStats?.level || 1;
      const nextLevelExp = Math.pow(level, 2) * 10;
      const currentLevelExp = Math.pow(level - 1, 2) * 10;
      return Math.min(100, Math.max(0, ((exp - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-10 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-5xl bg-cyber-900 border border-cyber-accent/40 rounded-3xl shadow-[0_0_80px_rgba(0,240,255,0.1)] overflow-hidden flex flex-col md:flex-row h-full max-h-[90vh] md:max-h-[800px] relative">
        
        {/* Left ID Section */}
        <div className="w-full md:w-[320px] bg-cyber-800 border-b md:border-b-0 md:border-r border-cyber-700/50 p-6 md:p-10 flex flex-col shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white md:hidden"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          
          <div className="text-center">
            <div className="relative inline-block mb-6">
                <div className={`absolute -inset-2 rounded-full blur-xl opacity-30 ${targetUser.isGuaranteed ? 'bg-yellow-400' : 'bg-cyber-accent'}`}></div>
                <img src={targetUser.avatar} className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-cyber-900 bg-black object-cover ${targetUser.isGuaranteed ? 'ring-2 ring-yellow-400' : 'ring-2 ring-cyber-accent'}`} alt="" />
                {targetUser.isGuaranteed && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-yellow-400 text-black text-[9px] font-black px-3 py-1 rounded-full border border-white shadow-xl uppercase">
                        Verified Fixed
                    </div>
                )}
            </div>
            
            <h2 className="text-2xl font-black text-white tracking-tighter italic uppercase">{targetUser.username}</h2>
            <div className="text-xs text-cyber-accent font-mono mb-8 opacity-60">@{targetUser.accountName}</div>
            
            <div className="bg-cyber-900/50 rounded-2xl p-4 border border-cyber-700/50 mb-8">
                <div className="flex justify-between text-[10px] text-gray-500 mb-2 font-black uppercase tracking-widest">
                    <span>Rank: {targetUser.merchantStats?.title || 'Civ'}</span>
                    <span>Lv.{targetUser.merchantStats?.level || 1}</span>
                </div>
                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-cyber-700/50">
                    <div className="h-full bg-gradient-to-r from-cyber-accent to-cyber-success shadow-[0_0_10px_#00f0ff]" style={{ width: `${getLevelProgress()}%` }} />
                </div>
                <div className="text-[8px] text-right text-gray-600 mt-1 font-mono uppercase tracking-tighter">Sync Stability: 99.8%</div>
            </div>

            <div className="space-y-3">
                {!isMe && !targetUser.isNpc && (
                    <div className="flex gap-2">
                        <Button variant="ghost" className="flex-1 bg-cyber-900/50 border-cyber-700" onClick={() => onOpenChat?.(targetUser.id)}>通讯 (DM)</Button>
                        <Button variant="primary" className="flex-1" onClick={handleRequestTrade} loading={isProcessing}>交易 (Trade)</Button>
                    </div>
                )}
                {!isMe && !targetUser.isNpc && !isFriend && (
                    <Button onClick={handleAddFriend} variant="success" className="w-full" loading={isProcessing}>建立神经链路 (Link)</Button>
                )}
                {isFriend && !isMe && (
                    <div className="text-[10px] text-cyber-success font-black uppercase tracking-[0.2em] py-3 border border-cyber-success/20 bg-cyber-success/5 rounded-xl">Neural Link Active</div>
                )}
                {isMe && (
                    <div className="bg-cyber-accent/10 border border-cyber-accent/30 rounded-xl p-3">
                        <p className="text-[9px] text-cyber-accent font-black uppercase mb-1">Total Credits</p>
                        <p className="text-xl font-mono text-white font-bold">{targetUser.credits} CR</p>
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* Right Content Section */}
        <div className="flex-1 flex flex-col bg-cyber-900/40 min-h-0 overflow-hidden">
            <header className="flex border-b border-cyber-700/50 shrink-0">
                {['info', 'inventory', 'reviews'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-4 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === t ? 'text-cyber-accent' : 'text-gray-500 hover:text-gray-300'}`}>
                        {t === 'info' ? '个人概况' : t === 'inventory' ? '物品库存' : '声望评价'}
                        {activeTab === t && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-cyber-accent shadow-[0_0_10px_#00f0ff]"></div>}
                    </button>
                ))}
                <button onClick={onClose} className="px-6 border-l border-cyber-700/50 text-gray-500 hover:text-white hidden md:block transition-colors">&times;</button>
            </header>
            
            <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar">
                {activeTab === 'info' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-cyber-800 p-5 rounded-2xl border border-cyber-700/50 group hover:border-cyber-accent/30 transition-colors">
                                <div className="text-gray-500 text-[10px] uppercase font-black mb-1 tracking-widest">Trade Count</div>
                                <div className="text-3xl font-black text-white italic group-hover:scale-110 origin-left transition-transform">{targetUser.merchantStats?.tradeCount || 0}</div>
                            </div>
                            <div className="bg-cyber-800 p-5 rounded-2xl border border-cyber-700/50 group hover:border-cyber-success/30 transition-colors">
                                <div className="text-gray-500 text-[10px] uppercase font-black mb-1 tracking-widest">Reputation Score</div>
                                <div className="text-3xl font-black text-cyber-success italic group-hover:scale-110 origin-left transition-transform">{targetUser.merchantStats?.reputation || 0}%</div>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <div className="text-[10px] text-gray-600 uppercase font-black tracking-widest px-1">Neural Signature Bio</div>
                             <div className="p-5 bg-cyber-800/80 rounded-2xl border border-cyber-700/50 text-sm leading-relaxed text-gray-300 italic border-l-4 border-l-cyber-accent">
                                "{targetUser.bio || 'This wanderer chooses to remain silent in the neural void.'}"
                             </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'inventory' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                        {targetUser.inventory?.length > 0 ? targetUser.inventory.map((item, idx) => (
                            <div key={idx} className="p-4 bg-cyber-800 rounded-2xl border border-cyber-700/50 hover:border-cyber-accent transition-all group">
                                <div className={`w-2 h-2 rounded-full mb-3 ${item.rarity === 'legendary' ? 'bg-yellow-400 shadow-[0_0_8px_#fcee0a]' : item.rarity === 'rare' ? 'bg-cyber-accent shadow-[0_0_8px_#00f0ff]' : 'bg-gray-500'}`}></div>
                                <div className="font-black text-white text-xs uppercase group-hover:text-cyber-accent transition-colors mb-1">{item.name}</div>
                                <div className="text-[10px] text-gray-500 leading-tight h-8 overflow-hidden line-clamp-2">{item.description}</div>
                            </div>
                        )) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
                                <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                <p className="text-xs uppercase font-mono tracking-widest">Inventory Data Null</p>
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'reviews' && (
                    <div className="space-y-4 animate-fade-in">
                        {!targetUser.reviews || targetUser.reviews.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={1} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                <p className="text-xs uppercase font-mono tracking-widest">No review entries found</p>
                            </div>
                        ) : (
                            targetUser.reviews.map(rev => (
                                <div key={rev.id} className="bg-cyber-800/80 border border-cyber-700/50 p-5 rounded-2xl relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-cyber-accent font-black uppercase text-[10px] italic">{rev.reviewerName}</span>
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <span key={i} className={`text-xs ${i < rev.rating ? 'text-yellow-400' : 'text-gray-700'}`}>★</span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-300 leading-relaxed italic">"{rev.comment}"</p>
                                    <div className="text-[8px] text-gray-600 mt-3 text-right font-mono">{new Date(rev.timestamp).toLocaleDateString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
