'use client';

import React from 'react';

import type { Note } from '../../lib/types';
import { cn } from '../../lib/cn';

interface NoteCardProps {
  note: Note;
  isArchiveView?: boolean;
  onOpen: (note: Note) => void;
  onTogglePin?: (note: Note) => void;
  onArchive?: (note: Note) => void;
  onRestore?: (note: Note) => void;
}

function autoTextColor(hex: string | null | undefined): string {
  if (!hex) return 'var(--text-primary)';
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (normalized.length !== 6) return 'var(--text-primary)';
  const r = parseInt(normalized.slice(0, 2), 16) || 0;
  const g = parseInt(normalized.slice(2, 4), 16) || 0;
  const b = parseInt(normalized.slice(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? 'var(--text-primary)' : '#ffffff';
}

function NoteChip({ label, background }: { label: string; background: string | null | undefined }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: background ?? 'var(--surface-soft)',
        color: autoTextColor(background),
      }}
    >
      {label}
    </span>
  );
}

export function NoteCard({
  note,
  isArchiveView = false,
  onOpen,
  onTogglePin,
  onArchive,
  onRestore,
}: NoteCardProps) {
  const textColor = autoTextColor(note.color);
  const background = note.color || 'var(--surface-0)';
  const isArchived = Boolean(note.archived_at);
  const showRestoreAction = isArchived && onRestore;
  const showArchiveAction = !isArchived && onArchive;
  const canTogglePin = !isArchived && !isArchiveView && onTogglePin;

  return (
    <article
      className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-subtle bg-[var(--surface-0)] p-5 shadow-soft transition-base hover:-translate-y-1 hover:shadow-lg"
      onClick={() => onOpen(note)}
      style={{ backgroundColor: background }}
      data-note-id={note.id}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          {isArchived ? (
            <span className="inline-flex w-fit items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
              В архиве
            </span>
          ) : null}
          {note.title ? (
            <h3 className="text-lg font-semibold" style={{ color: textColor }}>
              {note.title}
            </h3>
          ) : null}
          <p className="line-clamp-6 text-sm leading-relaxed" style={{ color: textColor }}>
            {note.content}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canTogglePin ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin?.(note);
              }}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 transition-base hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                note.pinned ? 'bg-white/20 text-white' : 'text-white/80',
              )}
              aria-label={note.pinned ? 'Открепить заметку' : 'Закрепить заметку'}
            >
              <span className="text-lg">📌</span>
            </button>
          ) : null}
          {showRestoreAction ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRestore?.(note);
              }}
              className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition-base hover:bg-white/30"
            >
              Восстановить
            </button>
          ) : null}
          {showArchiveAction ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onArchive?.(note);
              }}
              className="inline-flex rounded-full bg-black/30 px-3 py-1 text-xs text-white transition-base hover:bg-black/40"
            >
              Архивировать
            </button>
          ) : null}
        </div>
      </header>
      <footer className="flex flex-wrap items-center gap-2">
        <NoteChip label={note.area.name} background={note.area.color} />
        {note.project ? <NoteChip label={note.project.name} background="rgba(255,255,255,0.35)" /> : null}
      </footer>
    </article>
  );
}
