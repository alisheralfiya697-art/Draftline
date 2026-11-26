import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DocumentFilter, SeededUser } from '../types/document';

interface TopBarProps {
  activeSection: DocumentFilter | 'notes';
  onSelectSection: (section: DocumentFilter | 'notes') => void;
  users: SeededUser[];
  activeUser: SeededUser | null;
  onSwitchUser: (userId: string) => void;
}

export function TopBar({
  activeSection,
  onSelectSection,
  users,
  activeUser,
  onSwitchUser,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  const navItems: { id: DocumentFilter | 'notes'; label: string }[] = [
    { id: 'all', label: 'All Documents' },
    { id: 'owned', label: 'Owned by Me' },
    { id: 'shared', label: 'Shared with Me' },
    { id: 'notes', label: 'Project Notes' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectSection('all')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          Draftline
        </button>

        {/* Zone 2: Concise single-line text navigation links */}
        <nav
          aria-label="Workspace views"
          className="hidden md:flex items-center gap-6"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Active seeded user switcher */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {activeUser?.initials ?? 'ML'}
            </span>
            <span className="max-w-[140px] truncate">
              {activeUser?.name ?? 'Select user'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {menuOpen && (
            <div
              role="listbox"
              aria-label="Switch active seeded user"
              className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50"
            >
              <div className="px-3.5 py-2 border-b border-slate-100">
                <p className="text-xs font-medium text-slate-500">
                  Switch active account
                </p>
              </div>
              {users.map((user) => {
                const selected = user.id === activeUser?.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSwitchUser(user.id);
                      setMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      selected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center shrink-0 ${
                          selected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {user.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {user.email} · {user.role}
                        </p>
                      </div>
                    </div>
                    {selected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <div className="md:hidden border-t border-slate-100 px-4 flex items-center gap-4 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
