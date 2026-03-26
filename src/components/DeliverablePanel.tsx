'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface DeliverablePanelProps {
  deliverableId: string;
  primaryFile: string | null;
  manifestPath: string | null;
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function isImage(ext: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
}

function isVideo(ext: string): boolean {
  return ['mp4', 'webm'].includes(ext);
}

export default function DeliverablePanel({
  deliverableId,
  primaryFile,
}: DeliverablePanelProps) {
  const [markdownHtml, setMarkdownHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const fileUrl = primaryFile
    ? `/api/deliverables/${deliverableId}/file?path=deliverables/${primaryFile}`
    : null;

  const ext = primaryFile ? getFileExtension(primaryFile) : '';

  // Fetch markdown content for rendering
  useEffect(() => {
    if (!fileUrl || ext !== 'md') return;
    const fetchMd = async () => {
      try {
        const res = await fetch(fileUrl);
        if (res.ok) {
          const text = await res.text();
          setMarkdownHtml(marked.parse(text) as string);
        } else {
          setLoadError(true);
        }
      } catch {
        setLoadError(true);
      }
    };
    fetchMd();
  }, [fileUrl, ext]);

  // Empty state
  if (!primaryFile) {
    return (
      <div className="empty-state">
        <h3>No deliverable yet</h3>
        <p>The agent is still working. Check the Build Log for live progress.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="empty-state">
        <h3>This file could not be loaded</h3>
        <p>The file may have been moved or deleted. Check the Files tab for current workspace contents.</p>
      </div>
    );
  }

  // Markdown
  if (ext === 'md' && markdownHtml) {
    return (
      <div style={{ padding: '16px' }}>
        <div
          className="md-render"
          dangerouslySetInnerHTML={{ __html: markdownHtml }}
        />
      </div>
    );
  }

  // Image
  if (isImage(ext)) {
    return (
      <div style={{ padding: '16px' }}>
        <img
          src={fileUrl!}
          alt={primaryFile}
          style={{ maxWidth: '100%', borderRadius: 'var(--radius)' }}
        />
      </div>
    );
  }

  // Video
  if (isVideo(ext)) {
    return (
      <div style={{ padding: '16px' }}>
        <video controls style={{ width: '100%' }}>
          <source src={fileUrl!} />
        </video>
      </div>
    );
  }

  // PDF
  if (ext === 'pdf') {
    return (
      <div style={{ padding: '16px' }}>
        <iframe
          src={fileUrl!}
          style={{ width: '100%', height: '80vh', border: 'none' }}
          title={primaryFile}
        />
      </div>
    );
  }

  // Other: download link
  return (
    <div style={{ padding: '16px' }}>
      <p>
        <a href={fileUrl!} download={primaryFile} style={{ color: 'var(--accent)' }}>
          Download {primaryFile}
        </a>
      </p>
    </div>
  );
}
