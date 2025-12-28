
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading,
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold uppercase tracking-wider transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-cyber-accent focus:ring-offset-2 focus:ring-offset-cyber-900 active:scale-95";
  
  const variants = {
    primary: "bg-cyber-accent text-cyber-900 border-cyber-accent hover:bg-opacity-80 shadow-[0_0_10px_rgba(0,240,255,0.2)]",
    secondary: "bg-cyber-700 text-cyber-accent border-cyber-600 hover:border-cyber-accent hover:text-white",
    danger: "bg-cyber-danger text-white border-cyber-danger hover:bg-opacity-80 shadow-[0_0_10px_rgba(255,42,109,0.2)]",
    ghost: "bg-transparent text-gray-400 border-transparent hover:text-white hover:bg-cyber-800",
    success: "bg-cyber-success text-cyber-900 border-cyber-success hover:bg-opacity-80 shadow-[0_0_10px_rgba(5,255,161,0.2)]"
  };

  const sizes = {
    sm: "px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs",
    md: "px-4 py-2 text-xs md:text-sm",
    lg: "px-6 py-3 text-sm md:text-base"
  };

  return (
    <button
      disabled={disabled || loading}
      className={`
        ${baseStyles} 
        ${variants[variant]} 
        ${sizes[size]} 
        ${disabled || loading ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]'}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="hidden md:inline">处理中...</span>
        </span>
      ) : children}
    </button>
  );
};
