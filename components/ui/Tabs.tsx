'use client';

import React, { useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  rightElement?: React.ReactNode;
}

export default function Tabs({ tabs, activeTab, onTabChange, children, rightElement }: TabsProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <nav className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-6 py-3 font-medium transition whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="ml-1 text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
        {rightElement && <div className="mr-4">{rightElement}</div>}
      </div>

      <div className="p-6">{children}</div>
    </div>
  );
}
