import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import {
  FileCode,
  Box,
  FunctionSquare,
  Plus,
  RefreshCw,
  Zap,
  Info,
  Maximize2,
  Filter,
} from 'lucide-react';
import { fetchGalaxyView, fetchNodeImpact } from '../services/api';

// Custom Node Component
function NexusCustomNode({ id, data, isSelected }) {
  const isBlastCenter = data.isBlastCenter;
  const isBlastImpacted = data.isBlastImpacted;
  const isDimmed = data.isDimmed;

  let borderColor = '#38bdf8';
  let bgColor = 'rgba(14, 165, 233, 0.12)';
  let Icon = FileCode;
  let tagColor = '#00f2fe';

  if (data.type === 'Class') {
    borderColor = '#a855f7';
    bgColor = 'rgba(168, 85, 247, 0.14)';
    Icon = Box;
    tagColor = '#c084fc';
  } else if (data.type === 'Function') {
    borderColor = '#f59e0b';
    bgColor = 'rgba(245, 158, 11, 0.14)';
    Icon = FunctionSquare;
    tagColor = '#fbbf24';
  }

  // Blast radius override
  if (isBlastCenter) {
    borderColor = '#ef4444';
    bgColor = 'rgba(239, 68, 68, 0.25)';
    tagColor = '#f87171';
  } else if (isBlastImpacted) {
    borderColor = '#f43f5e';
    bgColor = 'rgba(244, 63, 94, 0.18)';
  }

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: '10px',
        background: bgColor,
        backdropFilter: 'blur(12px)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: isBlastCenter
          ? '0 0 20px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.3)'
          : isBlastImpacted
          ? '0 0 14px rgba(244, 63, 94, 0.4)'
          : `0 4px 14px rgba(0, 0, 0, 0.4)`,
        opacity: isDimmed ? 0.2 : 1,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        minWidth: '150px',
        maxWidth: '220px',
        cursor: 'pointer',
        position: 'relative',
      }}
      className={isBlastCenter ? 'blast-pulse' : ''}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor, width: 6, height: 6 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <Icon size={14} color={tagColor} />
          <span
            style={{
              fontWeight: 600,
              fontSize: '12px',
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data.label || 'Entity'}
          </span>
        </div>

        {/* Dynamic Contextual Expansion '+' Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (data.onExpand) data.onExpand(id);
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          title="Contextual Expansion: fetch 1st & 2nd degree dependencies"
        >
          <Plus size={10} />
        </button>
      </div>

      <div
        style={{
          marginTop: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '9.5px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ color: tagColor, textTransform: 'uppercase', fontWeight: 600 }}>
          {isBlastCenter ? 'BLAST ROOT' : isBlastImpacted ? 'IMPACTED' : data.type}
        </span>
        {data.line_number && <span>L{data.line_number}</span>}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = {
  nexusNode: NexusCustomNode,
};

export default function CanvasPane({
  focusEntityName,
  onOpenCodeDrawer,
  externalGraphData,
  activeRepo,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isGalaxyLoading, setIsGalaxyLoading] = useState(false);
  const [blastInfo, setBlastInfo] = useState(null);

  // Layout helper to convert raw nodes & edges into React Flow format with a circular/layered layout
  const layoutGraph = useCallback((rawNodes, rawEdges, expandCallback) => {
    const total = rawNodes.length;
    const radius = Math.max(250, total * 35);
    const centerX = 350;
    const centerY = 300;

    const rfNodes = rawNodes.map((n, idx) => {
      // Circular or spiral distribution for galaxy overview
      const angle = (idx / Math.max(1, total)) * 2 * Math.PI;
      const dist = radius * (0.4 + 0.6 * ((idx % 3) / 2));
      const x = centerX + dist * Math.cos(angle);
      const y = centerY + dist * Math.sin(angle);

      return {
        id: n.id,
        type: 'nexusNode',
        position: { x, y },
        data: {
          ...n,
          onExpand: expandCallback,
          isBlastCenter: false,
          isBlastImpacted: false,
          isDimmed: false,
        },
      };
    });

    const rfEdges = rawEdges.map((e, idx) => ({
      id: `edge-${e.source}-${e.target}-${idx}`,
      source: e.source,
      target: e.target,
      label: e.relationship_type,
      animated: e.relationship_type === 'CALLS',
      style: {
        stroke: e.relationship_type === 'CALLS' ? '#f59e0b' : e.relationship_type === 'INHERITS_FROM' ? '#a855f7' : '#38bdf8',
        strokeWidth: 1.5,
        opacity: 0.7,
      },
      labelStyle: {
        fill: '#94a3b8',
        fontSize: '9px',
        fontFamily: 'monospace',
      },
      labelBgStyle: {
        fill: '#0f1422',
        fillOpacity: 0.8,
      },
    }));

    return { rfNodes, rfEdges };
  }, []);

  // Contextual expansion callback for the '+' button on a node
  const handleExpandNode = useCallback(
    async (nodeId) => {
      try {
        const impact = await fetchNodeImpact(nodeId);
        if (!impact.nodes || impact.nodes.length === 0) return;

        setNodes((currentNodes) => {
          const existingIds = new Set(currentNodes.map((n) => n.id));
          const parentNode = currentNodes.find((n) => n.id === nodeId);
          const px = parentNode ? parentNode.position.x : 300;
          const py = parentNode ? parentNode.position.y : 300;

          const newNodes = [];
          impact.nodes.forEach((n, idx) => {
            if (!existingIds.has(n.id)) {
              existingIds.add(n.id);
              const angle = (idx / impact.nodes.length) * 2 * Math.PI;
              newNodes.push({
                id: n.id,
                type: 'nexusNode',
                position: {
                  x: px + 180 * Math.cos(angle),
                  y: py + 180 * Math.sin(angle),
                },
                data: {
                  ...n,
                  onExpand: handleExpandNode,
                  isBlastCenter: false,
                  isBlastImpacted: true,
                  isDimmed: false,
                },
              });
            }
          });
          return [...currentNodes, ...newNodes];
        });

        setEdges((currentEdges) => {
          const existingEdgeIds = new Set(currentEdges.map((e) => `${e.source}->${e.target}`));
          const newEdges = [];

          impact.edges.forEach((e, idx) => {
            const key = `${e.source}->${e.target}`;
            if (!existingEdgeIds.has(key)) {
              existingEdgeIds.add(key);
              newEdges.push({
                id: `expanded-edge-${e.source}-${e.target}-${idx}`,
                source: e.source,
                target: e.target,
                label: e.relationship_type,
                animated: true,
                style: { stroke: '#ef4444', strokeWidth: 2.2, opacity: 0.9 },
                labelStyle: { fill: '#ef4444', fontSize: '9px' },
              });
            }
          });
          return [...currentEdges, ...newEdges];
        });
      } catch (err) {
        console.error('Failed to expand node:', err);
      }
    },
    [setNodes, setEdges]
  );

  // Load Galaxy View from backend
  const loadGalaxyView = useCallback(async () => {
    setIsGalaxyLoading(true);
    setSelectedNodeId(null);
    setBlastInfo(null);
    try {
      const data = await fetchGalaxyView(200);
      const { rfNodes, rfEdges } = layoutGraph(data.nodes || [], data.edges || [], handleExpandNode);
      setNodes(rfNodes);
      setEdges(rfEdges);
    } catch (err) {
      console.error('Error loading Galaxy View:', err);
    } finally {
      setIsGalaxyLoading(false);
    }
  }, [layoutGraph, handleExpandNode, setNodes, setEdges]);

  // Initial load
  useEffect(() => {
    loadGalaxyView();
  }, [loadGalaxyView]);

  // When chat updates graph data (Canvas Sync)
  useEffect(() => {
    if (externalGraphData && externalGraphData.nodes && externalGraphData.nodes.length > 0) {
      const { rfNodes, rfEdges } = layoutGraph(
        externalGraphData.nodes,
        externalGraphData.edges || [],
        handleExpandNode
      );
      setNodes(rfNodes);
      setEdges(rfEdges);
    }
  }, [externalGraphData, layoutGraph, handleExpandNode, setNodes, setEdges]);

  // Trigger Blast Radius on Single Click
  const handleNodeClick = useCallback(
    async (event, node) => {
      event.stopPropagation();
      const nodeId = node.id;
      setSelectedNodeId(nodeId);

      try {
        const impact = await fetchNodeImpact(nodeId);
        const impactedNodeIds = new Set((impact.nodes || []).map((n) => n.id));
        impactedNodeIds.add(nodeId);

        setBlastInfo({
          centerNode: node.data.label,
          impactCount: (impact.nodes || []).length,
          edgeCount: (impact.edges || []).length,
        });

        // Update nodes: dim unrelated nodes, illuminate blast radius
        setNodes((nds) =>
          nds.map((n) => {
            const isCenter = n.id === nodeId;
            const isImpacted = impactedNodeIds.has(n.id);
            return {
              ...n,
              data: {
                ...n.data,
                isBlastCenter: isCenter,
                isBlastImpacted: isImpacted && !isCenter,
                isDimmed: !isImpacted,
              },
            };
          })
        );

        // Update edges: glowing RED for blast connections
        setEdges((eds) =>
          eds.map((e) => {
            const connectsToBlast = impactedNodeIds.has(e.source) && impactedNodeIds.has(e.target);
            return {
              ...e,
              animated: connectsToBlast,
              style: connectsToBlast
                ? { stroke: '#ef4444', strokeWidth: 3, opacity: 1, filter: 'drop-shadow(0 0 6px #ef4444)' }
                : { ...e.style, opacity: 0.15 },
            };
          })
        );
      } catch (err) {
        console.error('Failed to calculate Blast Radius:', err);
      }
    },
    [setNodes, setEdges]
  );

  // Double Click: Open sliding CodeDrawer
  const handleNodeDoubleClick = useCallback(
    (event, node) => {
      event.stopPropagation();
      if (onOpenCodeDrawer) {
        onOpenCodeDrawer(node.data);
      }
    },
    [onOpenCodeDrawer]
  );

  // Background Click: Reset Blast Radius
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setBlastInfo(null);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isBlastCenter: false,
          isBlastImpacted: false,
          isDimmed: false,
        },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        animated: e.label === 'CALLS',
        style: {
          stroke: e.label === 'CALLS' ? '#f59e0b' : e.label === 'INHERITS_FROM' ? '#a855f7' : '#38bdf8',
          strokeWidth: 1.5,
          opacity: 0.7,
        },
      }))
    );
  }, [setNodes, setEdges]);

  // Focus entity if triggered by chat pill click
  useEffect(() => {
    if (!focusEntityName || nodes.length === 0) return;

    const matched = nodes.find(
      (n) =>
        n.data.label?.toLowerCase() === focusEntityName.toLowerCase() ||
        n.data.file_path?.toLowerCase().includes(focusEntityName.toLowerCase())
    );

    if (matched) {
      handleNodeClick({ stopPropagation: () => {} }, matched);
    }
  }, [focusEntityName, nodes, handleNodeClick]);

  return (
    <section
      style={{
        width: '40%',
        minWidth: '400px',
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Canvas Top Bar */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(15, 20, 34, 0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={16} color="var(--cyan-glow)" />
          <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
            Architecture Canvas
          </span>

          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px 8px',
              borderRadius: '10px',
              color: 'var(--text-secondary)',
            }}
          >
            {nodes.length} Nodes • {edges.length} Edges
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedNodeId && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePaneClick}
              style={{ fontSize: '11px', padding: '4px 10px', color: '#f87171' }}
            >
              Reset Blast Radius
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={loadGalaxyView}
            disabled={isGalaxyLoading}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            title="Reload entire Galaxy View from Neo4j"
          >
            <RefreshCw size={11} className={isGalaxyLoading ? 'animate-spin' : ''} />
            <span>Galaxy</span>
          </button>
        </div>
      </div>

      {/* Blast Radius Status Banner */}
      {blastInfo && (
        <div
          style={{
            padding: '8px 18px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid var(--border-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#fca5a5',
            zIndex: 15,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 8px #ef4444',
              }}
            />
            <span>
              <strong>Blast Radius Active:</strong> [[{blastInfo.centerNode}]] affects{' '}
              <strong>{blastInfo.impactCount}</strong> connected components across {blastInfo.edgeCount} dependency edges.
            </span>
          </div>

          <span style={{ fontSize: '11px', opacity: 0.8 }}>Double-click to inspect code</span>
        </div>
      )}

      {/* Interactive React Flow Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="rgba(255, 255, 255, 0.05)" gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              if (n.data?.type === 'Class') return '#a855f7';
              if (n.data?.type === 'Function') return '#f59e0b';
              return '#0ea5e9';
            }}
            maskColor="rgba(10, 13, 20, 0.85)"
            style={{
              backgroundColor: '#070a12',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          />
        </ReactFlow>

        {/* Canvas Instructions Hint */}
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            right: '14px',
            background: 'rgba(15, 20, 34, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          <Info size={13} color="var(--cyan-glow)" />
          <span>Single-click = Blast Radius • Double-click = View Code • (+) = Expand</span>
        </div>
      </div>
    </section>
  );
}
