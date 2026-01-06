'use client';

import { ReactNode } from 'react';
import { MobileMenuButton } from './mobile-menu-button';

interface PageHeaderProps {
  title: string;
  description?: string;
  rightContent?: ReactNode;
}

export function PageHeader({ title, description, rightContent }: PageHeaderProps) {
  return (
    <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-3 md:px-8 md:py-4">
      <div className="flex items-center gap-3">
        <MobileMenuButton />
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-white md:text-2xl">{title}</h1>
            {description && <p className="text-xs text-slate-400 md:text-sm">{description}</p>}
          </div>
          {rightContent && <div className="flex items-center">{rightContent}</div>}
        </div>
      </div>
    </div>
  );
}
