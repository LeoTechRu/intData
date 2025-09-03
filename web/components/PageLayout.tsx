import React, { ReactNode } from 'react';

export default function PageLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-layout">
      <header className="p-4 border-b">
        <h1 className="text-xl font-bold" data-testid="page-title">
          {title}
        </h1>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
