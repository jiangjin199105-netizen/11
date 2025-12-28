
import React, { useState, useEffect, useRef } from 'react';
import { User, Item, TradeSession, TradeOffer, TradeReview } from '../types';
import { Button } from './Button';
import { negotiateTrade } from '../services/geminiService';
import { ITEMS_DB, mockDb } from '../services/mockDb';
import { toast } from '../services/toastService';

interface TradeInterfaceProps {
  user: User;
  onClose: () => void;
  onTradeComplete: (cost: number, item: Item) => void;
  tradeId?: string; 
}

export const TradeInterface: React.FC<TradeInterfaceProps> = ({ user, onClose, onTradeComplete, tradeId }) => {
  if (tradeId) {
      return <P2PTradeView user={user} tradeId={tradeId!} onClose={onClose} />;
  } else {
      return <NPCTradeView user={user} onClose={onClose} onTradeComplete={onTradeComplete} />;
  }
};

const P2PTradeView: React.FC<{ user: User, tradeId: string, onClose: () => void }> = ({ user, tradeId, onClose }) => {
    const [trade, setTrade] = useState<TradeSession | null>(null);
    const [partner, setPartner] = useState<User | null>(null);
    const [myCredits, setMyCredits] = useState(0);
    const [myItems, setMyItems] = useState<Item[]>([]);
    const [isFinished, setIsFinished] = useState(false);
    
    // Review State
    const [showReview, setShowReview] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('交易愉快，信用极佳！');

    useEffect(() => {
        const unsub = mockDb.subscribeToTrade(tradeId, async (updated) => {
            if (!updated) return;
            setTrade(updated);
            if (!partner) {
                const pid = updated.participants.find(id => id !== user.id);
                if (pid) setPartner(await mockDb.getUser(pid) || null);
            }
            if (updated.status === 'completed' && !isFinished) {
                setIsFinished(true);
                setShowReview(true);
                toast.success("交易已结算！获得经验值。");
            }
            if (updated.status === 'cancelled') onClose();
        });
        return () => unsub();
    }, [tradeId]);

    const handleLock = async () => {
        await mockDb.updateTradeOffer(tradeId, user.id, myCredits, myItems);
        await mockDb.toggleTradeLock(tradeId, user.id, !trade?.offers[user.id].isLocked);
        const pid = trade?.participants.find(id => id !== user.id)!;
        if (trade?.offers[pid].isLocked) {
             await mockDb.finalizeTrade(tradeId);
        }
    };

    const submitReview = async () => {
        if (!partner) return;
        try {
            await mockDb.addTradeReview(partner.id, {
                reviewerId: user.id,
                reviewerName: user.username,
                rating,
                comment
            });
            toast.success("评价已提交");
            onClose();
        } catch (e) { onClose(); }
    };

    if (!trade || !partner) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fade-in">
            {showReview ? (
                <div className="bg-cyber-800 border border-cyber-accent p-8 rounded-lg max-w-md w-full animate-fade-in-up">
                    <h2 className="text-xl font-bold text-white mb-4 text-center">交易评价</h2>
                    <p className="text-sm text-gray-400 mb-6 text-center">评价对方 @{partner.username} 的信誉等级</p>
                    <div className="flex justify-center gap-4 text-3xl mb-6">
                        {[1,2,3,4,5].map(star => (
                            <button key={star} onClick={() => setRating(star)} className={star <= rating ? 'text-yellow-400' : 'text-gray-600'}>★</button>
                        ))}
                    </div>
                    <textarea 
                        className="w-full bg-cyber-900 border border-cyber-700 rounded p-3 text-white text-sm mb-4 h-24"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="选填评价内容..."
                    />
                    <Button onClick={submitReview} className="w-full">完成评价</Button>
                </div>
            ) : (
                <div className="w-full max-w-4xl h-[80vh] bg-cyber-900 border border-cyber-accent rounded shadow-2xl flex flex-col">
                    <div className="p-4 border-b border-cyber-700 flex justify-between bg-cyber-800">
                        <span className="font-bold">SECURE P2P TRADE</span>
                        <Button size="sm" variant="danger" onClick={() => mockDb.cancelTrade(tradeId)}>取消</Button>
                    </div>
                    <div className="flex-1 flex p-6 gap-6">
                        {/* Simple Trade View Implementation */}
                        <div className="flex-1 bg-cyber-800 p-4 border border-cyber-700 rounded text-center">
                            <img src={user.avatar} className="w-16 h-16 rounded-full mx-auto mb-2 border border-cyber-accent" />
                            <div className="text-white font-bold">{user.username}</div>
                            <div className="mt-4 p-4 border-2 border-dashed border-cyber-600">
                                <input type="number" value={myCredits} onChange={e => setMyCredits(Number(e.target.value))} className="bg-transparent text-2xl font-mono text-center w-full text-yellow-400" />
                                <div className="text-[10px] text-gray-500">出价 CR</div>
                            </div>
                        </div>
                        <div className="flex items-center text-4xl text-cyber-accent">⚡</div>
                        <div className="flex-1 bg-cyber-800 p-4 border border-cyber-700 rounded text-center">
                            <img src={partner.avatar} className="w-16 h-16 rounded-full mx-auto mb-2 border border-gray-600" />
                            <div className="text-white font-bold">{partner.username}</div>
                            <div className="mt-4 p-4 border-2 border-dashed border-gray-700 h-24 flex items-center justify-center">
                                <span className="text-yellow-400 text-2xl font-mono">{trade.offers[partner.id].credits} CR</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-cyber-800 border-t border-cyber-700 flex justify-center">
                        <Button onClick={handleLock} className="w-64 h-12">
                            {trade.offers[user.id].isLocked ? '等待对方确认...' : '锁定并确认'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const NPCTradeView = (props: any) => <div>NPC 交易视图 (已简化)</div>;
