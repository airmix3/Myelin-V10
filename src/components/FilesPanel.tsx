'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDeliverable: boolean;
}

interface FilesPanelProps {
  deliverableId: string;
  workspacePath: string;
  refreshCounter?: number;
}

const FILE_ICONS: Record<string, string> = {
  md: '\uD83D\uDCC4',
  py: '\uD83D\uDC0D',
  js: '\u2699',
  ts: '\u2699',
  json: '\uD83D\uDCC4',
  csv: '\uD83D\uDCCA',
  png: '\uD83D\uDDBC',
  jpg: '\uD83D\uDDBC',
  jpeg: '\uD83D\uDDBC',
  gif: '\uD83D\uDDBC',
  svg: '\uD83D\uDDBC',
  webp: '\uD83D\uDDBC',
  mp4: '\uD83C\uDFA5',
  webm: '\uD83C\uDFA5',
  pdf: '\uD83D\uDCC1',
};

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const VIDEO_EXTS = ['mp4', 'webm'];
const CODE_EXTS = ['py', 'js', 'ts', 'css', 'json', 'csv'];

function getExt(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getIcon(filename: string): string {
  const ext = getExt(filename);
  return FILE_ICONS[ext] || '\uD83D\uDCC4';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPanel({
  deliverableId,
  refreshCounter,
}: FilesPanelProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [deskExpanded, setDeskExpanded] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch file list
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch(`/api/deliverables/${deliverableId}/file?list=true`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data.files ?? []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchFiles();
  }, [deliverableId, refreshCounter]);

  const deliverableFiles = files.filter(f => f.isDeliverable);
  const deskFiles = files.filter(f => !f.isDeliverable);

  const handleFileClick = async (file: FileInfo) => {
    // If same file is already previewing, close it
    if (previewFile?.path === file.path) {
      setPreviewFile(null);
      setPreviewContent(null);
      return;
    }

    setPreviewFile(file);
    setPreviewContent(null);

    const ext = getExt(file.name);
    const fileUrl = `/api/deliverables/${deliverableId}/file?path=${encodeURIComponent(file.path)}`;

    // For text-based files, fetch content
    if (ext === 'md' || CODE_EXTS.includes(ext)) {
      try {
        const res = await fetch(fileUrl);
        if (res.ok) {
          const text = await res.text();
          if (ext === 'md') {
            setPreviewContent(marked.parse(text) as string);
          } else {
            setPreviewContent(text);
          }
        }
      } catch { /* ignore */ }
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewContent(null);
  };

  if (loading) {
    return <div style={{ padding: '16px', color: 'var(--text-dim)', fontSize: '12px' }}>Loading files...</div>;
  }

  if (files.length === 0) {
    return (
      <div className="empty-state">
        <h3>No files yet</h3>
        <p>Files will appear here as the agent creates them in the workspace.</p>
      </div>
    );
  }

  const renderFileGrid = (fileList: FileInfo[]) => (
    <div className="file-grid">
      {fileList.map(file => (
        <div
          key={file.path}
          className="file-card"
          onClick={() => handleFileClick(file)}
          style={previewFile?.path === file.path ? { borderColor: 'var(--accent)' } : undefined}
        >
          <div className="file-card-icon">{getIcon(file.name)}</div>
          <div className="file-card-name" title={file.name}>{file.name}</div>
          <div className="file-card-size">{formatSize(file.size)}</div>
        </div>
      ))}
    </div>
  );

  const renderPreview = () => {
    if (!previewFile) return null;

    const ext = getExt(previewFile.name);
    const fileUrl = `/api/deliverables/${deliverableId}/file?path=${encodeURIComponent(previewFile.path)}`;

    return (
      <div className="file-preview">
        <button className="file-preview-close" onClick={closePreview}>X</button>

        {/* Image preview */}
        {IMAGE_EXTS.includes(ext) && (
          <img src={fileUrl} alt={previewFile.name} style={{ maxWidth: '100%' }} />
        )}

        {/* Video preview */}
        {VIDEO_EXTS.includes(ext) && (
          <video controls style={{ width: '100%' }}>
            <source src={fileUrl} />
          </video>
        )}

        {/* PDF preview */}
        {ext === 'pdf' && (
          <iframe src={fileUrl} style={{ width: '100%', height: '60vh', border: 'none' }} title={previewFile.name} />
        )}

        {/* Markdown preview */}
        {ext === 'md' && previewContent && (
          <div className="md-render" dangerouslySetInnerHTML={{ __html: previewContent }} />
        )}

        {/* Code preview */}
        {CODE_EXTS.includes(ext) && previewContent && (
          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: 'var(--radius)', overflow: 'auto', maxHeight: '60vh' }}>
            <code style={{ fontSize: '11px', color: 'var(--text)' }}>{previewContent}</code>
          </pre>
        )}

        {/* Unsupported preview */}
        {!IMAGE_EXTS.includes(ext) && !VIDEO_EXTS.includes(ext) && ext !== 'pdf' && ext !== 'md' && !CODE_EXTS.includes(ext) && (
          <p style={{ fontSize: '12px' }}>
            Preview not available.{' '}
            <a href={fileUrl} download={previewFile.name} style={{ color: 'var(--accent)' }}>Download file.</a>
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Deliverables section (always expanded) */}
      {deliverableFiles.length > 0 && (
        <div>
          <div style={{ padding: '8px 16px', fontSize: '10px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>
            Deliverables
          </div>
          {renderFileGrid(deliverableFiles)}
        </div>
      )}

      {/* Desk / Working Files section (collapsible, default collapsed) */}
      {deskFiles.length > 0 && (
        <div>
          <div
            className="collapsible-header"
            onClick={() => setDeskExpanded(!deskExpanded)}
          >
            <span style={{ display: 'inline-block', transform: deskExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              &#9654;
            </span>
            Desk / Working Files ({deskFiles.length})
          </div>
          {deskExpanded && renderFileGrid(deskFiles)}
        </div>
      )}

      {/* Preview panel */}
      {renderPreview()}
    </div>
  );
}
