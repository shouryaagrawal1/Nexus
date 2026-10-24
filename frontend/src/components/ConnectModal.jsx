import React, { useState, useEffect } from 'react';
import { X, FolderCode, Terminal, CheckCircle2, AlertCircle, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { connectRepo, subscribeToIngestion } from '../services/api';

export default function ConnectModal({ isOpen, onClose, onIngestionComplete }) {
  const [repoPath, setRepoPath] = useState('');
  const [pythonEnabled, setPythonEnabled] = useState(true);
  const [cppEnabled, setCppEnabled] = useState(true);
  const [excludeFolders, setExcludeFolders] = useState('node_modules, venv, build, .git, .chroma_data, neo4j_data');

  // Ingestion State
  const [isIngesting, setIsIngesting] = useState(false);
  const [stage, setStage] = useState(''); // AST_PARSING, GRAPH_MAPPING, VECTOR_EMBEDDING, COMPLETE, ERROR
  const [progress, setProgress] = useState({
    ast: { current: 0, total: 100, message: 'Waiting...' },
    graph: { current: 0, total: 100, message: 'Waiting...' },
    vector: { current: 0, total: 100, message: 'Waiting...' },
  });
  const [logs, setLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    let timer;
    if (isIngesting && stage !== 'COMPLETE') {
      timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isIngesting, stage]);

  if (!isOpen) return null;

  const handleStartIngest = async () => {
    if (!repoPath.trim()) {
      setErrorMsg('Please specify an absolute folder path.');
      return;
    }

    const languages = [];
    if (pythonEnabled) languages.push('python');
    if (cppEnabled) languages.push('cpp');

    if (languages.length === 0) {
      setErrorMsg('Please select at least one language.');
      return;
    }

    const excludes = excludeFolders
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setErrorMsg(null);
    setIsIngesting(true);
    setStage('CONNECTING');
    setLogs([`Validating directory: ${repoPath}...`]);
    setElapsedSeconds(0);

    try {
      const connectRes = await connectRepo({
        absolutePath: repoPath.trim(),
        languages,
        excludeFolders: excludes,
      });

      setLogs((prev) => [
        ...prev,
        `✓ Repository validated. Found ${connectRes.valid_files_count} valid files.`,
        `Initializing SSE ingestion session [${connectRes.session_id}]...`,
      ]);

      const unsubscribe = subscribeToIngestion(connectRes.session_id, {
        onEvent: (event) => {
          setStage(event.stage);

          if (event.stage === 'AST_PARSING') {
            setProgress((p) => ({
              ...p,
              ast: { current: event.current, total: event.total, message: event.message },
            }));
          } else if (event.stage === 'GRAPH_MAPPING') {
            setProgress((p) => ({
              ...p,
              graph: { current: event.current, total: event.total, message: event.message },
            }));
          } else if (event.stage === 'VECTOR_EMBEDDING') {
            setProgress((p) => ({
              ...p,
              vector: { current: event.current, total: event.total, message: event.message },
            }));
          }

          if (event.message) {
            setLogs((prev) => [...prev.slice(-30), `[${event.stage}] ${event.message}`]);
          }
        },
        onError: (err) => {
          setErrorMsg(err.message || 'Ingestion encountered an error.');
          setStage('ERROR');
          setIsIngesting(false);
        },
        onComplete: (event) => {
          setStage('COMPLETE');
          setIsIngesting(false);
          setLogs((prev) => [...prev, `🎉 ${event.message || 'Indexing finished successfully!'}`]);
          if (onIngestionComplete) {
            onIngestionComplete({
              path: repoPath.trim(),
              name: repoPath.trim().split(/[\\/]/).filter(Boolean).pop() || 'workspace',
              validFiles: connectRes.valid_files_count,
            });
          }
        },
      });
    } catch (err) {
      setErrorMsg(err.message);
      setIsIngesting(false);
      setStage('ERROR');
    }
  };

  const getPercentage = (current, total) => {
    if (!total || total === 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
  };

  const setDummyPath = () => {
    setRepoPath('C:\\Users\\shour\\OneDrive\\Desktop\\nexus\\dummy_test_repo');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (!isIngesting && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '640px',
          maxWidth: '100%',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 242, 254, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderCode size={22} color="var(--cyan-glow)" />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Index Local Workspace
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Dual-engine AST extraction, Neo4j graph mapping &amp; ChromaDB vectorization
              </p>
            </div>
          </div>

          {!isIngesting && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--border-danger)',
                color: '#f87171',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isIngesting && stage !== 'COMPLETE' ? (
            <>
              {/* Directory Path Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Absolute Directory Path
                  </label>
                  <button
                    type="button"
                    onClick={setDummyPath}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--cyan-glow)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={11} />
                    <span>Use dummy_test_repo</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="e.g., C:\Users\Dev\Projects\LegacySystem"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--cyan-glow)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
                />
              </div>

              {/* Languages Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Languages to Parse (AST Aware)
                </label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={pythonEnabled}
                      onChange={(e) => setPythonEnabled(e.target.checked)}
                      style={{ accentColor: '#00f2fe' }}
                    />
                    <span>Python (.py)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={cppEnabled}
                      onChange={(e) => setCppEnabled(e.target.checked)}
                      style={{ accentColor: '#00f2fe' }}
                    />
                    <span>C / C++ (.cpp, .h, .hpp)</span>
                  </label>
                </div>
              </div>

              {/* Exclude Folders */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Exclude Folders (comma-separated)
                </label>
                <input
                  type="text"
                  value={excludeFolders}
                  onChange={(e) => setExcludeFolders(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          ) : (
            /* Progress State */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                  {stage === 'COMPLETE' ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : (
                    <Loader2 size={18} className="animate-spin" color="var(--cyan-glow)" />
                  )}
                  <span>
                    {stage === 'COMPLETE' ? 'Indexing Completed Successfully' : 'Ingesting Repository Architecture...'}
                  </span>
                </div>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {elapsedSeconds}s elapsed
                </span>
              </div>

              {/* 3 Progress Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0, 0, 0, 0.3)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                {/* 1. AST Parsing */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>1. Building Abstract Syntax Trees (Tree-sitter)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan-glow)' }}>
                      {progress.ast.current} / {progress.ast.total} files
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${getPercentage(progress.ast.current, progress.ast.total)}%`,
                        background: 'linear-gradient(90deg, #00f2fe, #4facfe)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* 2. Neo4j Graph Mapping */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>2. Mapping Graph Relationships (Neo4j)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--purple-glow)' }}>
                      {progress.graph.current} / {progress.graph.total}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${getPercentage(progress.graph.current, progress.graph.total)}%`,
                        background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* 3. ChromaDB Vector Embedding */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>3. Generating Semantic Vectors (ChromaDB)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber-glow)' }}>
                      {progress.vector.current} / {progress.vector.total} chunks
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${getPercentage(progress.vector.current, progress.vector.total)}%`,
                        background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Progress Terminal */}
              <div
                style={{
                  background: '#04060c',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                  height: '130px',
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#94a3b8',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', marginBottom: '4px' }}>
                  <Terminal size={12} />
                  <span>Ingestion Event Stream</span>
                </div>
                {logs.map((log, idx) => (
                  <div key={idx} style={{ wordBreak: 'break-all' }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          {stage === 'COMPLETE' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
              style={{ padding: '10px 20px' }}
            >
              <span>Explore Architecture Canvas</span>
              <ArrowRight size={15} />
            </button>
          ) : isIngesting ? (
            <button
              type="button"
              className="btn-secondary"
              disabled
              style={{ opacity: 0.6 }}
            >
              <Loader2 size={14} className="animate-spin" />
              <span>Ingesting...</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartIngest}
              >
                <Sparkles size={14} />
                <span>Parse &amp; Index Architecture</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
