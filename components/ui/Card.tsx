import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  onClick?: () => void;
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export default function Card({
  children,
  className = '',
  padding = 'md',
  hoverable = false,
  onClick
}: CardProps) {
  const baseClasses = 'bg-white dark:bg-gray-800 rounded-lg shadow';
  const hoverClasses = hoverable ? 'hover:shadow-lg transition-shadow cursor-pointer' : '';
  const paddingClass = paddingStyles[padding];

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${paddingClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
