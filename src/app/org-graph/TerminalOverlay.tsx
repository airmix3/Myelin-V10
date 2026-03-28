'use client';

import { useEffect, useRef, useState } from 'react';

interface TerminalOverlayProps {
  runId: string;
  agentName?: string;
  onClose: () => void;
}

export default function TerminalOverlay({ runId, agentName, onClose }: TerminalOverlayProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'active' | 'exiting' | 'ended'>('connecting');
  const termInstanceRef = useRef<unknown>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // Dynamic imports for xterm (needs DOM)
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      // Load xterm CSS via link tag (CSS imports not supported in dynamically imported modules)
      if (!document.querySelector('link[data-xterm-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/xterm.css';
        link.setAttribute('data-xterm-css', 'true');
        document.head.appendChild(link);
      }

      if (!mounted || !termRef.current) return;

      const terminal = new Terminal({
        theme: {
          background: '#0a0a0f',
          foreground: '#e0e0e8',
          cursor: '#e94560',
          selectionBackground: '#2a2a4a',
        },
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: 13,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(termRef.current);
      fitAddon.fit();

      termInstanceRef.current = terminal;

      // Connect to SSE stream for PTY output
      const es = new EventSource(`/api/terminal/${runId}`);
      esRef.current = es;

      es.addEventListener('data', (event) => {
        if (!mounted) return;
        try {
          const decoded = atob(event.data);
          terminal.write(decoded);
          setStatus('active');
        } catch {
          // skip
        }
      });

      es.addEventListener('exit', () => {
        if (!mounted) return;
        terminal.write('\r\n\x1b[33m--- Session ended ---\x1b[0m\r\n');
        setStatus('ended');
        setTimeout(() => {
          if (mounted) onClose();
        }, 2000);
      });

      es.addEventListener('error', () => {
        if (!mounted) return;
        // EventSource will auto-reconnect; if we're ending, just close
        if (status === 'exiting' || status === 'ended') {
          es.close();
        }
      });

      // Send keyboard input to terminal
      terminal.onData((data: string) => {
        fetch(`/api/terminal/${runId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'input', data: btoa(data) }),
        }).catch(() => {});
      });

      // Send resize events
      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        fetch(`/api/terminal/${runId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'resize', cols, rows }),
        }).catch(() => {});
      });

      // Handle window resize
      const onResize = () => fitAddon.fit();
      window.addEventListener('resize', onResize);

      setStatus('active');

      return () => {
        window.removeEventListener('resize', onResize);
      };
    }

    init();

    return () => {
      mounted = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (termInstanceRef.current) {
        (termInstanceRef.current as { dispose: () => void }).dispose();
        termInstanceRef.current = null;
      }
    };
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExitRole() {
    setStatus('exiting');

    // First try to gracefully exit Claude by sending /exit
    await fetch(`/api/terminal/${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'input', data: btoa('/exit\n') }),
    }).catch(() => {});

    // Wait 5s for graceful exit, then force-kill
    setTimeout(async () => {
      if (esRef.current) {
        await fetch(`/api/terminal/${runId}`, { method: 'DELETE' }).catch(() => {});
        onClose();
      }
    }, 5000);
  }

  return (
    <div className="terminal-overlay">
      <div className="terminal-overlay-bar">
        <span>
          Taking over {agentName || 'agent'} — Session {runId.slice(0, 8)}
          {status === 'connecting' && ' (connecting...)'}
          {status === 'exiting' && ' (exiting...)'}
          {status === 'ended' && ' (ended)'}
        </span>
        <button
          className="btn-exit"
          onClick={handleExitRole}
          disabled={status === 'exiting' || status === 'ended'}
        >
          Exit Role
        </button>
      </div>
      <div className="terminal-overlay-body" ref={termRef} />
    </div>
  );
}
