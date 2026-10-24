import React from 'react';
import { Layers, FolderGit2, Activity, Plus, RefreshCw, Cpu, Database, Network } from 'lucide-react';

export default function Sidebar({
  onOpenConnectModal,
  activeRepo,
  onResetGalaxy,
  health,
  onRefreshHealth,
}) {
  const getStatusColor = (status) => {
    if (status === 'connected' || status === 'ready' || status === 'operational') return '#10b981';
    if (status === 'checking') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <aside
      style={{
        width: '260px',
        minWidth: '240px',
        maxWidth: '300px',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        zIndex: 10,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '20px 18px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #7928ca 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0, 242, 254, 0.4)',
            }}
          >
            <Layers size={18} color="#050814" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.8px', color: '#fff' }}>
              NEXUS
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Dual-Engine RAG
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: '10px',
            background: 'rgba(56, 189, 248, 0.1)',
            color: 'var(--cyan-glow)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          v1.0
        </span>
      </div>

      {/* Primary Action Button */}
      <div style={{ padding: '16px 16px 12px' }}>
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
          onClick={onOpenConnectModal}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Connect Local Repo</span>
        </button>
      </div>

      {/* Workspaces Section */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            padding: '8px 8px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Active Workspace</span>
          <button
            type="button"
            onClick={onResetGalaxy}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-accent)',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Reload Galaxy Graph"
          >
            <RefreshCw size={10} />
            <span>Galaxy View</span>
          </button>
        </div>

        {activeRepo ? (
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-active)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <FolderGit2 size={16} color="var(--cyan-glow)" />
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                {activeRepo.name}
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
                marginBottom: '8px',
              }}
            >
              {activeRepo.path}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                }}
              />
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>
                {activeRepo.validFiles || 0} Files Indexed
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '24px 14px',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            No workspace connected yet. Click "+ Connect Local Repo" to index.
          </div>
        )}
      </div>

      {/* System Health Indicators */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(5, 8, 16, 0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Activity size={13} color="var(--cyan-glow)" />
            <span>SERVER HEALTH</span>
          </div>
          <button
            type="button"
            onClick={onRefreshHealth}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
            }}
            title="Refresh Server Health"
          >
            <RefreshCw size={11} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
          {/* ChromaDB */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Database size={12} />
              <span>ChromaDB Vector</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(health.services?.chromadb),
                  boxShadow: `0 0 6px ${getStatusColor(health.services?.chromadb)}`,
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {health.services?.chromadb || 'offline'}
              </span>
            </div>
          </div>

          {/* Neo4j */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Network size={12} />
              <span>Neo4j Graph DB</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(health.services?.neo4j),
                  boxShadow: `0 0 6px ${getStatusColor(health.services?.neo4j)}`,
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {health.services?.neo4j || 'offline'}
              </span>
            </div>
          </div>

          {/* Gemini API */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <Cpu size={12} />
              <span>Gemini LLM API</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(health.services?.llm_api),
                  boxShadow: `0 0 6px ${getStatusColor(health.services?.llm_api)}`,
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {health.services?.llm_api || 'offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
