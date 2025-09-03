'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface InboxNote {
  id: number;
  title?: string | null;
  content: string;
}

export default function InboxTable() {
  const { data } = useQuery<InboxNote[]>({
    queryKey: ['inbox'],
    queryFn: async () => {
      const res = await fetch('/api/v1/inbox/notes', {
        credentials: 'include',
      });
      if (!res.ok) {
        return [];
      }
      return res.json();
    },
  });

  if (!data || data.length === 0) {
    return (
      <div data-testid="empty" className="text-muted p-2">
        Пусто
      </div>
    );
  }

  return (
    <table className="min-w-full border">
      <thead>
        <tr>
          <th className="px-2 py-1 border">ID</th>
          <th className="px-2 py-1 border">Заголовок</th>
          <th className="px-2 py-1 border">Текст</th>
        </tr>
      </thead>
      <tbody>
        {data.map((n) => (
          <tr key={n.id}>
            <td className="px-2 py-1 border">{n.id}</td>
            <td className="px-2 py-1 border">{n.title ?? ''}</td>
            <td className="px-2 py-1 border">{n.content}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
