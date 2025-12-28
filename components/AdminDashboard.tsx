
import React, { useState, useEffect } from 'react';
import { User, Channel, BazaarPost } from '../types';
import { mockDb } from '../services/mockDb';
import { Button } from './Button';
import { toast } from '../services/toastService';

const UserRow: React.FC<{ user: User; onReload: () => void }> = ({ user, onReload }) => {
    const [credits, setCredits] = useState(user.credits);
    const [newPassword, setNewPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    
    const handleToggleGuaranteed = async () => {
        try {
            await mockDb.toggleUserGuaranteed(user.id, !user.isGuaranteed);
            toast.success(`${user.username} 的担保状态已更新`);
            onReload();
        } catch (e) { toast.error("操作失败"); }
    };

    const handleSaveCredits = async () => {
        setIsProcessing(true);
        try {
            await mockDb.updateUserCredits(user.id, credits);
            toast.success("资产已更新");
            onReload();
        } catch (e) { toast.error("更新资产失败"); }
        setIsProcessing(false);
    };

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast.error("密码至少需要6位");
            return;
        }
        setIsProcessing(true);
        try {
            const res = await mockDb.updateUserProfile(user.id, { password: newPassword });
            if (res.success) {
                toast.success("密码已强制重置");
                setNewPassword('');
            } else {
                toast.error(res.error || "重置失败");
            }
        } catch (e) { toast.error("系统错误"); }
        setIsProcessing(false);
    };

    const handleBan = async () => {
        if (confirm(`确定永久封禁用户 ${user.username} 吗？此操作不可逆。`)) {
            await mockDb.deleteUser(user.id);
            onReload();
        }
    };

    return (
        <tr className="hover:bg-cyber-700/50 border-b border-cyber-700 last:border-0 text-[11px]">
            <td className="p-3">
                <div className="flex items-center gap-3">
                    <img src={user.avatar} className="w-8 h-8 rounded border border-cyber-600 bg-black" alt="" />
                    <div className="flex flex-col min-w-[100px]">
                        <span className="text-white font-bold flex items-center gap-1">
                            {user.username}
                            {user.isGuaranteed && <span className="text-[8px] text-yellow-400 border border-yellow-400 px-1 rounded leading-tight">担保</span>}
                        </span>
                        <span className="opacity-50 font-mono text-[9px]">@{user.accountName}</span>
                    </div>
                </div>
            </td>
            <td className="p-3">
                <Button 
                    size="sm" 
                    variant={user.isGuaranteed ? 'danger' : 'success'} 
                    className="h-7 py-0 px-2 text-[10px] w-full"
                    onClick={handleToggleGuaranteed}
                >
                    {user.isGuaranteed ? '撤销担保' : '设为担保'}
                </Button>
            </td>
            <td className="p-3">
                <div className="flex items-center gap-1">
                    <input 
                        type="number" 
                        value={credits} 
                        onChange={e => setCredits(Number(e.target.value))}
                        className="w-20 bg-cyber-900 border border-cyber-600 rounded px-1 py-1 text-yellow-400 font-mono focus:border-cyber-accent outline-none"
                    />
                    <button onClick={handleSaveCredits} disabled={isProcessing} className="text-cyber-accent text-[10px] hover:text-white" title="保存余额">[存]</button>
                </div>
            </td>
            <td className="p-3">
                <div className="flex items-center gap-1">
                    <input 
                        type="text" 
                        placeholder="新密码"
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-24 bg-cyber-900 border border-cyber-600 rounded px-2 py-1 text-white text-[10px] focus:border-cyber-accent outline-none"
                    />
                    <button onClick={handleResetPassword} disabled={isProcessing} className="text-cyber-danger text-[10px] hover:text-white" title="强制修改密码">[重置]</button>
                </div>
            </td>
            <td className="p-3 text-right">
                <Button size="sm" variant="danger" className="h-7 py-0 text-[10px]" onClick={handleBan}>封禁</Button>
            </td>
        </tr>
    );
};

const ChannelRow: React.FC<{ channel: Channel; onReload: () => void }> = ({ channel, onReload }) => {
    const [broadcast, setBroadcast] = useState(channel.broadcastMessage || '');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdateBroadcast = async () => {
        setIsUpdating(true);
        try {
            await mockDb.updateChannelBroadcast(channel.id, broadcast);
            toast.success(`频道 #${channel.name} 公告已发布`);
            onReload();
        } catch (e) {
            toast.error("更新公告失败");
        }
        setIsUpdating(false);
    };

    return (
        <tr className="hover:bg-cyber-700/50 border-b border-cyber-700 last:border-0 text-[11px]">
            <td className="p-3">
                <div className="flex flex-col">
                    <span className="text-white font-bold">#{channel.name}</span>
                    <span className="opacity-50 font-mono text-[9px] truncate max-w-[150px]">{channel.description}</span>
                </div>
            </td>
            <td className="p-3">
                <span className="text-cyber-accent">{channel.playerCount} / {channel.maxPlayers}</span>
            </td>
            <td className="p-3">
                <div className="flex items-center gap-2">
                    <input 
                        type="text" 
                        placeholder="输入广播内容..."
                        value={broadcast} 
                        onChange={e => setBroadcast(e.target.value)}
                        className="flex-1 bg-cyber-900 border border-cyber-600 rounded px-2 py-1 text-white text-[10px] focus:border-cyber-accent outline-none"
                    />
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 py-0 px-2 text-[10px]" 
                        onClick={handleUpdateBroadcast}
                        loading={isUpdating}
                    >
                        广播
                    </Button>
                </div>
            </td>
            <td className="p-3 text-right">
                <span className={`text-[10px] px-2 py-0.5 rounded ${channel.isPrivate ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>
                    {channel.isPrivate ? 'PRIVATE' : 'PUBLIC'}
                </span>
            </td>
        </tr>
    );
};

const PostRow: React.FC<{ post: BazaarPost; onReload: () => void }> = ({ post, onReload }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    const handleDelete = async () => {
        if (confirm(`管理员权限：确定要强制删除 ${post.username} 的摊位吗？`)) {
            setIsDeleting(true);
            await mockDb.deleteBazaarPost(post.id);
            await mockDb.sendChannelMessage(post.channelId, { username: "ADMIN_SYSTEM" } as any, `摊位信号 [${post.content}] 已被管理员强制断开。`);
            toast.success("已强制下架");
            onReload();
            setIsDeleting(false);
        }
    };
    return (
        <tr className="hover:bg-cyber-700/50 border-b border-cyber-700 last:border-0 text-[11px]">
            <td className="p-3">
                <div className="flex items-center gap-2">
                    <img src={post.userAvatar} className="w-6 h-6 rounded-full" />
                    <span className="text-white">{post.username}</span>
                </div>
            </td>
            <td className="p-3">
                <span className="text-cyber-accent font-bold">#{post.channelId}</span>
            </td>
            <td className="p-3 text-gray-300 italic">
                "{post.content}"
            </td>
            <td className="p-3 text-right">
                <Button size="sm" variant="danger" className="h-6 py-0 px-2 text-[9px]" onClick={handleDelete} loading={isDeleting}>删除</Button>
            </td>
        </tr>
    );
};

export const AdminDashboard: React.FC = () => {
    const [view, setView] = useState<'users' | 'channels' | 'posts'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [posts, setPosts] = useState<BazaarPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const load = async () => {
        setLoading(true);
        const [u, c, p] = await Promise.all([
            mockDb.getAllUsers(),
            mockDb.getChannels(),
            mockDb.getAllActivePosts()
        ]);
        setUsers(u);
        setChannels(c);
        setPosts(p);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.accountName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredChannels = channels.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPosts = posts.filter(p => 
        p.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-cyber-900">
            <div className="p-6 shrink-0 bg-cyber-900 border-b border-cyber-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-cyber-danger tracking-widest flex items-center gap-2">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            管理控制台
                        </h1>
                        <p className="text-xs text-gray-500 font-mono mt-1">SUPERUSER ACCESS GRANTED</p>
                    </div>
                    <div className="flex gap-4 items-center w-full md:w-auto">
                        <input 
                            type="text" 
                            placeholder="全局过滤..." 
                            className="flex-1 md:flex-none bg-cyber-800 border border-cyber-700 rounded px-4 py-2 text-sm text-white focus:border-cyber-accent outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Button variant="secondary" size="sm" onClick={load} loading={loading}>刷新</Button>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={() => setView('users')}
                        className={`text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-t transition-all border-b-2 ${view === 'users' ? 'border-cyber-danger text-cyber-danger bg-cyber-danger/10' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        用户管理
                    </button>
                    <button 
                        onClick={() => setView('channels')}
                        className={`text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-t transition-all border-b-2 ${view === 'channels' ? 'border-cyber-warning text-cyber-warning bg-cyber-warning/10' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        频道管理
                    </button>
                    <button 
                        onClick={() => setView('posts')}
                        className={`text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-t transition-all border-b-2 ${view === 'posts' ? 'border-cyber-accent text-cyber-accent bg-cyber-accent/10' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        活跃摊位
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto p-6 pt-0">
                <div className="min-w-[800px] bg-cyber-800 border border-cyber-700 rounded overflow-hidden shadow-2xl mt-4">
                    <table className="w-full text-left border-collapse">
                        {view === 'users' && (
                            <>
                                <thead className="bg-cyber-900 text-cyber-accent uppercase text-[9px] font-bold tracking-widest">
                                    <tr>
                                        <th className="p-4 border-b border-cyber-700">用户</th>
                                        <th className="p-4 border-b border-cyber-700">担保</th>
                                        <th className="p-4 border-b border-cyber-700">余额 (CR)</th>
                                        <th className="p-4 border-b border-cyber-700">重置密码</th>
                                        <th className="p-4 border-b border-cyber-700 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-10 text-center text-cyber-accent animate-pulse">正在检索...</td></tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr><td colSpan={5} className="p-10 text-center text-gray-600">未找到用户</td></tr>
                                    ) : (
                                        filteredUsers.map(u => <UserRow key={u.id} user={u} onReload={load} />)
                                    )}
                                </tbody>
                            </>
                        )}
                        {view === 'channels' && (
                            <>
                                <thead className="bg-cyber-900 text-cyber-warning uppercase text-[9px] font-bold tracking-widest">
                                    <tr>
                                        <th className="p-4 border-b border-cyber-700">频道</th>
                                        <th className="p-4 border-b border-cyber-700">人数</th>
                                        <th className="p-4 border-b border-cyber-700">广播内容</th>
                                        <th className="p-4 border-b border-cyber-700 text-right">隐私</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={4} className="p-10 text-center text-cyber-warning animate-pulse">正在扫描...</td></tr>
                                    ) : filteredChannels.length === 0 ? (
                                        <tr><td colSpan={4} className="p-10 text-center text-gray-600">未检索到频道</td></tr>
                                    ) : (
                                        filteredChannels.map(c => <ChannelRow key={c.id} channel={c} onReload={load} />)
                                    )}
                                </tbody>
                            </>
                        )}
                        {view === 'posts' && (
                            <>
                                <thead className="bg-cyber-900 text-cyber-accent uppercase text-[9px] font-bold tracking-widest">
                                    <tr>
                                        <th className="p-4 border-b border-cyber-700">摊主</th>
                                        <th className="p-4 border-b border-cyber-700">频道ID</th>
                                        <th className="p-4 border-b border-cyber-700">内容</th>
                                        <th className="p-4 border-b border-cyber-700 text-right">管理</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={4} className="p-10 text-center text-cyber-accent animate-pulse">扫描信号中...</td></tr>
                                    ) : filteredPosts.length === 0 ? (
                                        <tr><td colSpan={4} className="p-10 text-center text-gray-600">目前暂无摊位在线</td></tr>
                                    ) : (
                                        filteredPosts.map(p => <PostRow key={p.id} post={p} onReload={load} />)
                                    )}
                                </tbody>
                            </>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};
