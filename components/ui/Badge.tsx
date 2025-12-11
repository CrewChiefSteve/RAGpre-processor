import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'processing'
  | 'azure'
  | 'vision'
  | 'pending'
  | 'ok'
  | 'low_confidence'
  | 'handwriting'
  | 'azure_figure'
  | 'azure_image'
  | 'vision_segment';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<BadgeVariant, string> = {
  // Status badges
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',

  // Quality badges
  ok: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  low_confidence: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  handwriting: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',

  // Source badges
  azure: 'bg-[#0078d4]/10 text-[#0078d4] dark:bg-[#0078d4]/20 dark:text-[#4da6ff]',
  vision: 'bg-[#10a37f]/10 text-[#10a37f] dark:bg-[#10a37f]/20 dark:text-[#6ee7b7]',
  azure_figure: 'bg-[#0078d4]/10 text-[#0078d4] dark:bg-[#0078d4]/20 dark:text-[#4da6ff]',
  azure_image: 'bg-[#0078d4]/10 text-[#0078d4] dark:bg-[#0078d4]/20 dark:text-[#4da6ff]',
  vision_segment: 'bg-[#10a37f]/10 text-[#10a37f] dark:bg-[#10a37f]/20 dark:text-[#6ee7b7]',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export default function Badge({ variant, children, size = 'md' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-semibold rounded ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}
