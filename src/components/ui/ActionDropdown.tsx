'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Edit, Trash2, Eye } from 'lucide-react';

export interface ActionDropdownAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ActionDropdownProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  actions?: ActionDropdownAction[];
}

export function ActionDropdown({ onView, onEdit, onDelete, actions }: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const defaultActions: ActionDropdownAction[] = [
    ...(onView ? [{ label: 'View Details', icon: Eye, onClick: onView, variant: 'default' as const }] : []),
    ...(onEdit ? [{ label: 'Edit', icon: Edit, onClick: onEdit, variant: 'default' as const }] : []),
    ...(onDelete ? [{ label: 'Delete', icon: Trash2, onClick: onDelete, variant: 'danger' as const }] : []),
  ];

  const menuActions = actions || defaultActions;

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (menuActions.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Row actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Row actions menu"
          className="absolute right-0 mt-2 w-48 bg-white rounded-lg elevated border border-stone-200 z-20 py-1"
        >
          {menuActions.map((action, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                action.variant === 'danger'
                  ? 'text-rose-600 hover:text-rose-700'
                  : 'text-slate-700'
              }`}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}