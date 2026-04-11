import React from 'react';

import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
}) => (
  <div className="flex items-center gap-4 mb-8">
    <div className="p-2.5 bg-slate-900 rounded-xl shadow-lg flex items-center justify-center">
      <Icon size={18} className="text-sky-400" strokeWidth={2.5} />
    </div>
    <div>
      <h2 className="text-lg font-black text-slate-800 m-0 tracking-tight leading-none">
        {title}
      </h2>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-none">
        {subtitle}
      </p>
    </div>
  </div>
);
