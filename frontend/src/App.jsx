import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatPane from './components/ChatPane';
import CanvasPane from './components/CanvasPane';
import ConnectModal from './components/ConnectModal';
import CodeDrawer from './components/CodeDrawer';
import { useHealth } from './hooks/useHealth';

export default function App() {
  const { health, refetch: refreshHealth } = useHealth(10000);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [activeRepo, setActiveRepo] = useState({
    name: 'dummy_test_repo',
    path: 'C:\\Users\\shour\\OneDrive\\Desktop\\nexus\\dummy_test_repo',
    validFiles: 3,
  });

  // Cross-component communication
  const [focusEntityName, setFocusEntityName] = useState(null);
  const [externalGraphData, setExternalGraphData] = useState(null);
  const [codeDrawerNode, setCodeDrawerNode] = useState(null);
  const [galaxyResetTrigger, setGalaxyResetTrigger] = useState(0);

  const handleIngestionComplete = (repoInfo) => {
    setActiveRepo(repoInfo);
    // Trigger galaxy view reload
    setGalaxyResetTrigger((c) => c + 1);
  };

  const handleSelectEntity = (name) => {
    setFocusEntityName(name);
  };

  const handleGraphUpdate = (graphData) => {
    setExternalGraphData(graphData);
  };

  const handleOpenCodeDrawer = (nodeData) => {
    setCodeDrawerNode(nodeData);
  };

  const handleCloseCodeDrawer = () => {
    setCodeDrawerNode(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Zone 1: Left Sidebar (15% width / ~260px) */}
      <Sidebar
        onOpenConnectModal={() => setConnectModalOpen(true)}
        activeRepo={activeRepo}
        onResetGalaxy={() => setGalaxyResetTrigger((c) => c + 1)}
        health={health}
        onRefreshHealth={refreshHealth}
      />

      {/* Zone 2: Center Pane (Intelligence Chat - 45% width) */}
      <ChatPane
        onSelectEntity={handleSelectEntity}
        onGraphUpdate={handleGraphUpdate}
        activeRepo={activeRepo}
        onOpenCodeDrawer={handleOpenCodeDrawer}
      />

      {/* Zone 3: Right Pane (Architecture Canvas - 40% width) */}
      <CanvasPane
        key={galaxyResetTrigger}
        focusEntityName={focusEntityName}
        onOpenCodeDrawer={handleOpenCodeDrawer}
        externalGraphData={externalGraphData}
        activeRepo={activeRepo}
      />

      {/* Sliding Code Drawer Overlay */}
      <CodeDrawer
        isOpen={Boolean(codeDrawerNode)}
        onClose={handleCloseCodeDrawer}
        nodeData={codeDrawerNode}
      />

      {/* Ingestion & Workspace Connection Modal */}
      <ConnectModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onIngestionComplete={handleIngestionComplete}
      />
    </div>
  );
}
