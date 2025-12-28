
import React, { useState, useEffect } from 'react';
import { Moment, User } from '../types';
import { mockDb } from '../services/mockDb';
import { Button } from './Button';
import { toast } from '../services/toastService';

interface MomentsViewProps {
  user: User;
}

export const MomentsView: React.FC<MomentsViewProps> = ({ user }) => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Comment State
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMoments();
  }, []);

  const loadMoments = async () => {
    const data = await mockDb.getMoments();
    setMoments(data);
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setLoading(true);
    await mockDb.createMoment(user.id, user.username, user.avatar, newPost);
    setNewPost('');
    await loadMoments();
    setLoading(false);
    toast.success("动态发布成功");
  };

  const handleSendComment = async (momentId: string) => {
      const text = commentInputs[momentId];
      if (!text || !text.trim()) return;

      setLoadingComments(prev => ({ ...prev, [momentId]: true }));
      try {
          await mockDb.addMomentComment(momentId, user, text);
          setCommentInputs(prev => ({ ...prev, [momentId]: '' }));
          await loadMoments(); // Refresh to show new comment
          toast.success("评论已发送");
      } catch (e) {
          toast.error("评论失败");
      }
      setLoadingComments(prev => ({ ...prev, [momentId]: false }));
  };

  const setCommentText = (id: string, text: string) => {
      setCommentInputs(prev => ({ ...prev, [id]: text }));
  };

  return (
    <div className="flex flex-col h-full bg-cyber-900">
      {/* Header */}
      <div className="p-4 border-b border-cyber-700 bg-cyber-800 flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <h2 className="text-xl font-bold text-white tracking-widest">朋友圈 <span className="text-xs text-cyber-accent">NEON NETWORK</span></h2>
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyber-danger to-cyber-accent animate-pulse"></div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Post Creator */}
        <div className="p-4 border-b border-cyber-700 bg-cyber-800/50">
          <div className="flex gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded bg-cyber-700" alt="me" />
            <div className="flex-1">
              <textarea 
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="分享你的赛博生活..."
                className="w-full bg-cyber-900 border border-cyber-600 rounded p-2 text-white text-sm focus:border-cyber-accent focus:outline-none resize-none h-20"
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={handlePost} loading={loading} disabled={!newPost.trim()}>发布动态</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="p-4 space-y-6">
          {moments.map(moment => (
            <div key={moment.id} className="flex gap-4 animate-fade-in-up">
              <img src={moment.avatar} className="w-10 h-10 rounded bg-cyber-700 shrink-0 border border-cyber-700" alt="avatar" />
              <div className="flex-1 pb-4 border-b border-cyber-700/50">
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-cyber-accent text-sm">{moment.username}</h3>
                    <span className="text-xs text-gray-600">{new Date(moment.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-200 text-sm mt-1 mb-3 whitespace-pre-wrap">{moment.content}</p>
                
                {/* Interaction Bar */}
                <div className="flex gap-4 text-xs text-gray-500 mb-3">
                    <button className="flex items-center gap-1 hover:text-cyber-danger transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        {moment.likes}
                    </button>
                    <button className="flex items-center gap-1 text-white hover:text-cyber-accent transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {moment.comments} 评论
                    </button>
                </div>

                {/* Comment Section */}
                <div className="bg-cyber-800/50 rounded p-2">
                    {/* List */}
                    {moment.commentsList && moment.commentsList.length > 0 && (
                        <div className="space-y-2 mb-3">
                            {moment.commentsList.map(c => (
                                <div key={c.id} className="text-xs flex gap-2">
                                    <span className="text-cyber-accent font-bold whitespace-nowrap">{c.username}:</span>
                                    <span className="text-gray-300">{c.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Input */}
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 bg-cyber-900 border border-cyber-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyber-accent"
                            placeholder="写下你的评论..."
                            value={commentInputs[moment.id] || ''}
                            onChange={e => setCommentText(moment.id, e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendComment(moment.id)}
                        />
                        <Button 
                            size="sm" 
                            className="px-2 py-0.5 text-[10px]" 
                            disabled={!commentInputs[moment.id]?.trim()}
                            loading={loadingComments[moment.id]}
                            onClick={() => handleSendComment(moment.id)}
                        >
                            发送
                        </Button>
                    </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
