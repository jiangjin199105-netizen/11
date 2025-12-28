
import React, { useState, useEffect } from 'react';
import { toast } from '../services/toastService';
import { playNotificationSound } from '../services/audioService';

interface ToastItem {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'info';
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsub = toast.subscribe((msg, type) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg, type }]);
      
      if (type === 'success') {
          playNotificationSound();
      }

      // Auto dismiss
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    });

    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`
            pointer-events-auto
            flex items-center gap-3 p-4 rounded shadow-2xl border backdrop-blur-md animate-fade-in-up
            ${t.type === 'success' ? 'bg-green-900/80 border-green-500 text-green-100' : ''}
            ${t.type === 'error' ? 'bg-red-900/80 border-red-500 text-red-100' : ''}
            ${t.type === 'info' ? 'bg-cyber-800/90 border-cyber-accent text-cyber-accent' : ''}
          `}
        >
          <div className={`
            w-6 h-6 rounded-full flex items-center justify-center border
            ${t.type === 'success' ? 'border-green-400 bg-green-500/20' : ''}
            ${t.type === 'error' ? 'border-red-400 bg-red-500/20' : ''}
            ${t.type === 'info' ? 'border-cyber-accent bg-cyber-accent/20' : ''}
          `}>
            {t.type === 'success' && '✓'}
            {t.type === 'error' && '!'}
            {t.type === 'info' && 'i'}
          </div>
          <span className="font-bold text-sm tracking-wide shadow-black drop-shadow-md">{t.msg}</span>
        </div>
      ))}
    </div>
  );
};
