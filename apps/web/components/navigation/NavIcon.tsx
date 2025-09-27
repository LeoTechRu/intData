'use client';

import clsx from 'clsx';
import React from 'react';

export interface NavIconProps {
  name?: string | null;
  className?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="13" width="7" height="8" rx="1.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M4.5 5.5h15a1 1 0 0 1 .95 1.3l-2.1 7a2 2 0 0 1-1.9 1.4H7.55a2 2 0 0 1-1.9-1.4l-2.1-7A1 1 0 0 1 4.5 5.5Z" />
      <path d="M3 12.5h4l1.2 2h7.6l1.2-2h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M7 3v4M17 3v4" />
      <path d="M4 11h16" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  reminders: (
    <>
      <path d="M12 3a5 5 0 0 0-5 5v3.764a2 2 0 0 1-.421 1.236l-1.756 2.34A1 1 0 0 0 5.635 17H9.5a2.5 2.5 0 0 0 5 0h3.865a1 1 0 0 0 .812-1.66l-1.756-2.34A2 2 0 0 1 17 11.764V8a5 5 0 0 0-5-5Z" />
      <path d="M9 8h6" />
    </>
  ),
  tasks: (
    <>
      <path d="M5 7h7M5 12h7M5 17h7" />
      <path d="m16 6 2 2 3-3" />
      <path d="m16 11 2 2 3-3" />
      <path d="m16 16 2 2 3-3" />
    </>
  ),
  projects: (
    <>
      <path d="M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M8 3h8v4H8Z" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  areas: (
    <>
      <path d="M4 6.5h16v11a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 17.5Z" />
      <path d="M8 6.5V4h8v2.5" />
      <path d="M9 12h2v4H9zM13 12h2v4h-2z" />
    </>
  ),
  resources: (
    <>
      <path d="M4 7h16" />
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M10 11h4" />
      <path d="M10 15h4" />
    </>
  ),
  notes: (
    <>
      <path d="M6 4h9l5 5v11a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M14 4v4h4" />
      <path d="M8 12h8M8 16h8" />
    </>
  ),
  products: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <path d="M8 7V4h8v3" />
      <path d="M9 13h6M9 17h6" />
    </>
  ),
  habits: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M7.5 20c1.5-2.5 3-4 4.5-4s3 1.5 4.5 4" />
      <path d="M5 8h2M17 8h2" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <path d="M13.5 18.5c.4-1.9 1.9-3.5 4.5-3.5 1.6 0 2.6.4 3 1" />
    </>
  ),
  groups: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16" cy="9" r="3" />
      <path d="M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <path d="M11 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2-1l-.9-1.6a1 1 0 0 1 .1-1.1l.8-.8a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-.8.8a1 1 0 0 1-1.1.1l-1.6-.9a1 1 0 0 0-1 0l-1.6.9a1 1 0 0 1-1.1-.1l-.8-.8a1 1 0 0 0-1.4 0L4 9.8a1 1 0 0 0 0 1.4l.8.8a1 1 0 0 1 .1 1.1l-.9 1.6a1 1 0 0 0 0 1l.9 1.6a1 1 0 0 1-.1 1.1l-.8.8a1 1 0 0 0 0 1.4L5.4 21a1 1 0 0 0 1.4 0l.8-.8a1 1 0 0 1 1.1-.1l1.6.9a1 1 0 0 0 1 0l1.6-.9a1 1 0 0 1 1.1.1l.8.8a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4l-.8-.8a1 1 0 0 1-.1-1.1Z" />
    </>
  ),
  admin: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M12 10v6M8 13h8" />
      <path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1Z" />
    </>
  ),
  'module-control-hub': (
    <>
      <path d="M4 4h8v8H4Z" />
      <path d="M12 12h8v8h-8Z" />
      <path d="M4 16h6v4H4Z" />
      <path d="M16 4h4v6h-4Z" />
    </>
  ),
  'module-tasks-projects': (
    <>
      <path d="M5 5h14v4H5Z" />
      <path d="M5 11h8v4H5Z" />
      <path d="M5 17h6v2H5Z" />
      <path d="m17 13 2 2 3-3" />
    </>
  ),
  'module-knowledge': (
    <>
      <path d="M6 5h12a1 1 0 0 1 1 1v12l-7-3-7 3V6a1 1 0 0 1 1-1Z" />
      <path d="M12 5v8" />
    </>
  ),
  'module-team': (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M6 20c.8-3.5 3.2-5.5 6-5.5s5.2 2 6 5.5" />
    </>
  ),
  'module-admin': (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6v6H9Z" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </>
  ),
  'module-generic': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 8h8v8H8Z" />
    </>
  ),
  'nav-generic': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
    </>
  ),
};

export function NavIcon({ name, className }: NavIconProps) {
  const normalizedKey = (() => {
    if (!name) {
      return 'nav-generic';
    }
    if (Object.prototype.hasOwnProperty.call(ICON_MAP, name)) {
      return name;
    }
    if (name.startsWith('module-')) {
      return 'module-generic';
    }
    return 'nav-generic';
  })();
  const node = ICON_MAP[normalizedKey] ?? ICON_MAP['nav-generic'];

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={clsx('h-5 w-5 flex-none stroke-[1.6] text-current', className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {node}
    </svg>
  );
}

export default NavIcon;
