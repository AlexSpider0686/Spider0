import { ReactNode } from 'react';

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function SectionHeader({ eyebrow, title, children }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div className="section-header__eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
