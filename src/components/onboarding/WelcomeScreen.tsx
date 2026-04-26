'use client';

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-panel rounded-2xl p-10 max-w-[480px] w-full text-center">
        <h1
          className="text-white mb-4"
          style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15 }}
        >
          Let&apos;s Build Your Company
        </h1>

        <p
          className="text-slate-400 mb-8"
          style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
        >
          Your Chief of Staff will guide you through setting up your Living Company.
          It takes about 20 minutes.
        </p>

        <button
          onClick={onStart}
          className="rounded-lg text-white cursor-pointer transition-colors hover:bg-sky-500"
          style={{
            backgroundColor: '#38bdf8',
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 12,
            paddingBottom: 12,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
