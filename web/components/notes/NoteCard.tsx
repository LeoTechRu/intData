'use client';

import React from 'react';

import type { Note } from '../../lib/types';
import { cn } from '../../lib/cn';

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
  onOpen,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}) {
  const textColor = autoTextColor(note.color);
  const background = note.color || 'var(--surface-0)';

  return (
    <article
      className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-subtle bg-[var(--surface-0)] p-5 shadow-soft transition-base hover:-translate-y-1 hover:shadow-lg"
      onClick={() => onOpen(note)}
      style={{ backgroundColor: background }}
      data-note-id={note.id}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
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
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(note);
            }}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 transition-base hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              note.pinned ? 'bg-white/20 text-white' : 'text-white/80',
            )}
            aria-label={note.pinned ? 'Открепить заметку' : 'Закрепить заметку'}
          >
            <span className="text-lg">📌</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(note);
            }}
            className="hidden rounded-full bg-black/30 px-3 py-1 text-xs text-white transition-base group-hover:inline-flex"
          >
            Удалить
          </button>
        </div>
      </header>
      <footer className="flex flex-wrap items-center gap-2">
        <NoteChip label={note.area.name} background={note.area.color} />
        {note.project ? <NoteChip label={note.project.name} background="rgba(255,255,255,0.35)" /> : null}
      </footer>
    </article>
  );
}
