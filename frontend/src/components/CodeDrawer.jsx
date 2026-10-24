import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileCode, ExternalLink, Loader2 } from 'lucide-react';
import { fetchFileContent } from '../services/api';

export default function CodeDrawer({ isOpen, onClose, nodeData }) {
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !nodeData) return;

    // If node already has snippet code attached
    if (nodeData.code) {
      setContent(nodeData.code);
      setLoading(false);
      return;
    }

    // Otherwise fetch from /api/repo/file-content
    if (nodeData.file_path) {
      setLoading(true);
      setError(null);
      fetchFileContent(nodeData.file_path, nodeData.line_number, null)
        .then((data) => {
          setContent(data.code);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, nodeData]);

  if (!isOpen || !nodeData) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = content ? content.split('\n') : [];
  const startLine = nodeData.line_number || nodeData.start_line || 1;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '480px',
        maxWidth: '100%',
        height: '100%',
        background: 'rgba(11, 15, 25, 0.96)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-subtle)',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.7)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileCode size={18} color="var(--cyan-glow)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              {nodeData.label || nodeData.name || 'Code Inspection'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {nodeData.file_path || 'source file'} {nodeData.line_number ? `(Line ${nodeData.line_number})` : ''}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopy}
            title="Copy Code"
            disabled={loading || !content}
          >
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Close Drawer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          background: '#070a12',
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)', gap: '8px' }}>
            <Loader2 className="animate-spin" size={18} />
            <span>Loading source code...</span>
          </div>
        ) : error ? (
          <div style={{ padding: '20px', color: 'var(--rose-blast)' }}>
            Failed to read file: {error}
          </div>
        ) : lines.length === 0 ? (
          <div style={{ padding: '20px', color: 'var(--text-muted)' }}>No code available for this entity.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', userSelect: 'text' }}>
            <tbody>
              {lines.map((line, idx) => {
                const lineNum = startLine + idx;
                return (
                  <tr key={idx} style={{ lineHeight: '20px' }}>
                    <td
                      style={{
                        width: '45px',
                        padding: '0 12px 0 16px',
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        userSelect: 'none',
                        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                        opacity: 0.6,
                        fontSize: '11px',
                      }}
                    >
                      {lineNum}
                    </td>
                    <td style={{ padding: '0 16px', whiteSpace: 'pre', color: '#e2e8f0' }}>
                      {line || ' '}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <span>Entity Type: <strong style={{ color: 'var(--cyan-glow)' }}>{nodeData.type || 'Source'}</strong></span>
        <span>{lines.length} lines displayed</span>
      </div>
    </div>
  );
}
