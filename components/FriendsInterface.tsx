
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { mockDb } from '../services/mockDb';
import { Button } from './Button';
import { toast } from '../services/toastService';

interface FriendsInterfaceProps {
  currentUser: User;
  onUpdateCurrentUser: (user: User) => void;
  onOpenChat: (userId: string) => void;
  onOpenProfile: (user: User) => void;
}

type Tab = 'list' | 'add';

export const FriendsInterface: React.FC<FriendsInterfaceProps> = ({ currentUser, onUpdateCurrentUser, onOpenChat, onOpenProfile }) => {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const [searchAccountName, setSearchAccountName] = useState('');
  const [searchResult, setSearchResult] = useState<{found: boolean, msg: string, user?: User} | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab, currentUser.friends.length]);

  const loadData = async () => {
    setLoading(true);
    try {
        if (activeTab === 'list' && currentUser.friends.length > 0) {
            const list = await mockDb.getUsersByIds(currentUser.friends);
            setFriends(list);
        } else if (activeTab === 'list') {
            setFriends([]);
        }
    } catch (e) {
        console.error("Failed to load friends data", e);
    }
    setLoading(false);
  };

  const handleSearchAndAdd = async () => {
      if (!searchAccountName.trim()) return;
      if (searchAccountName.toLowerCase() === currentUser.accountName.toLowerCase()) {
          toast.error("不能添加自己");
          return;
      }
      setLoading(true);
      const foundUser = await mockDb.findUserByAccountName(searchAccountName.trim());
      if (foundUser) {
          if (currentUser.friends.includes(foundUser.id)) {
               setSearchResult({found: true, msg: "你们已经是好友了", user: foundUser});
          } else {
               setSearchResult({found: true, msg: "找到用户", user: foundUser});
          }
      } else {
          setSearchResult({found: false, msg: "未找到该账号"});
      }
      setLoading(false);
  };

  const addDirectly = async () => {
      if (!searchResult?.user) return;
      setLoading(true);
      try {
          const updated = await mockDb.addFriendDirectly(currentUser.id, searchResult.user.id);
          onUpdateCurrentUser(updated);
          toast.success(`已与 ${searchResult.user.username} 建立链接`);
          setSearchResult(null);
          setSearchAccountName('');
          setActiveTab('list');
      } catch (e) { toast.error("添加失败"); }
      setLoading(false);
  };

  const filteredFriends = friends.filter(f => {
      const name = currentUser.friendNicknames?.[f.id] || f.username;
      return name.toLowerCase().includes(filter.toLowerCase()) || f.accountName.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-cyber-900 border-t md:border-t-0 border-cyber-700">
        <div className="flex border-b border-cyber-700 bg-cyber-800">
             <button 
                onClick={() => setActiveTab('list')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'list' ? 'text-cyber-accent border-b-2 border-cyber-accent bg-cyber-accent/5' : 'text-gray-500 hover:text-white'}`}
            >
                好友列表 ({currentUser.friends.length})
            </button>
            <button 
                onClick={() => setActiveTab('add')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'add' ? 'text-cyber-accent border-b-2 border-cyber-accent bg-cyber-accent/5' : 'text-gray-500 hover:text-white'}`}
            >
                发现用户
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-cyber-900">
            {loading && <div className="text-center text-cyber-accent animate-pulse mt-10">检索中...</div>}

            {!loading && activeTab === 'list' && (
                <div className="max-w-3xl mx-auto">
                    <div className="mb-4">
                        <input 
                            className="w-full bg-cyber-800 border border-cyber-600 rounded p-3 text-white focus:border-cyber-accent outline-none"
                            placeholder="搜索好友..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                    {filteredFriends.length === 0 ? (
                        <div className="text-center text-gray-500 mt-10">列表为空。</div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredFriends.map(friend => (
                                <div key={friend.id} className="bg-cyber-800 border border-cyber-700 rounded p-4 flex items-center justify-between animate-fade-in">
                                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => onOpenProfile(friend)}>
                                        <div className="relative">
                                            <img src={friend.avatar} className="w-12 h-12 rounded bg-black" alt="" />
                                            {friend.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-cyber-800"></div>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-lg">{friend.username}</div>
                                            <div className="text-xs text-cyber-accent font-mono">@{friend.accountName}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" className="border border-cyber-600" onClick={() => onOpenChat(friend.id)}>
                                            私信
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {!loading && activeTab === 'add' && (
                <div className="max-w-xl mx-auto mt-10">
                    <div className="bg-cyber-800 border border-cyber-700 rounded p-6 shadow-lg">
                        <h3 className="text-white font-bold mb-4">按账号名称查找</h3>
                        <div className="flex gap-2 mb-6">
                            <input 
                                className="flex-1 bg-cyber-900 border border-cyber-600 rounded p-3 text-white focus:border-cyber-accent outline-none font-mono"
                                placeholder="输入账号..."
                                value={searchAccountName}
                                onChange={e => setSearchAccountName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearchAndAdd()}
                            />
                            <Button onClick={handleSearchAndAdd}>查找</Button>
                        </div>

                        {searchResult && (
                            <div className="animate-fade-in border-t border-cyber-700 pt-4">
                                {searchResult.found && searchResult.user ? (
                                    <div className="flex items-center justify-between bg-cyber-900/50 p-4 rounded border border-cyber-600">
                                        <div className="flex items-center gap-3">
                                            <img src={searchResult.user.avatar} className="w-12 h-12 rounded border border-cyber-500 cursor-pointer" alt="" onClick={() => onOpenProfile(searchResult.user!)} />
                                            <div className="cursor-pointer" onClick={() => onOpenProfile(searchResult.user!)}>
                                                <div className="text-white font-bold">{searchResult.user.username}</div>
                                                <div className="text-xs text-cyber-accent font-mono">@{searchResult.user.accountName}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" className="border border-cyber-600" onClick={() => onOpenChat(searchResult.user!.id)}>
                                                私信
                                            </Button>
                                            {currentUser.friends.includes(searchResult.user.id) ? (
                                                <span className="text-xs text-green-500 font-bold px-3 py-1 border border-green-500 rounded flex items-center">已好友</span>
                                            ) : (
                                                <Button size="sm" variant="success" onClick={addDirectly}>添加</Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-red-400 text-center p-3">
                                         {searchResult.msg}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
