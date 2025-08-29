import React from 'react';

export function renderSafeMd(md: string): React.ReactNode {
  const children: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m.index > last) children.push(md.slice(last, m.index));
    children.push(<a key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>);
    last = re.lastIndex;
  }
  if (last < md.length) children.push(md.slice(last));
  return <>{children}</>;
}
