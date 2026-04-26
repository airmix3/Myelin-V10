import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set Up Your Company',
  description: 'Company onboarding — configure your Living Company',
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
