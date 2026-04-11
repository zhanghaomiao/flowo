import React from 'react';

interface SettingsCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  children,
  className = '',
}) => (
  <div
    className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 ${className}`}
  >
    {children}
  </div>
);
