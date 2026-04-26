import TamirChatPage from '../../components/tamir/TamirChatPage';

export default function TamirPage() {
  return (
    <>
      <div className="ambient-bg" />
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div style={{ position: 'absolute', width: '600px', height: '600px', top: '40%', left: '45%', transform: 'translate(-50%, -50%)', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', filter: 'blur(80px)', animation: 'ambientFloat 20s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', top: '25%', right: '5%', background: 'radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'ambientFloat 24s ease-in-out infinite reverse', animationDelay: '3s' }} />
        <div style={{ position: 'absolute', width: '350px', height: '350px', bottom: '15%', left: '10%', background: 'radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)', filter: 'blur(50px)', animation: 'ambientFloat 18s ease-in-out infinite', animationDelay: '1.5s' }} />
      </div>
      <TamirChatPage />
    </>
  );
}
