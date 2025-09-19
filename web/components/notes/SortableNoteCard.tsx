'use client';

import React from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import type { Note } from '../../lib/types';
import { NoteCard } from './NoteCard';

interface SortableNoteCardProps {
  note: Note;
  isArchiveView?: boolean;
  onOpen: (note: Note) => void;
  onTogglePin?: (note: Note) => void;
  onArchive?: (note: Note) => void;
  onRestore?: (note: Note) => void;
}

export function SortableNoteCard({
  note,
  isArchiveView,
  onOpen,
  onTogglePin,
  onArchive,
  onRestore,
}: SortableNoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <NoteCard
        note={note}
        isArchiveView={isArchiveView}
        onOpen={onOpen}
        onTogglePin={onTogglePin}
        onArchive={onArchive}
        onRestore={onRestore}
      />
    </div>
  );
}
