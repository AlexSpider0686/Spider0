import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function LegalPageLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <div className="container legal-page__container">
        <Link className="legal-page__back" to="/">
          ← На главную
        </Link>
        <h1>{title}</h1>
        <div className="legal-page__content">{children}</div>
      </div>
    </main>
  );
}
