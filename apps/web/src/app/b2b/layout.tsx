import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yield2Pay para empresas',
  description:
    'O rendimento do capital da empresa paga o software. O principal continua seu.',
};

export default function B2bLayout({ children }: { children: React.ReactNode }) {
  return children;
}
