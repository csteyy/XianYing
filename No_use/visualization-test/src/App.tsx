import React, { useState } from 'react';
import ForceGraphCyberpunk from './components/ForceGraphCyberpunk';
import ForceGraphOrganic from './components/ForceGraphOrganic';
import ForceGraphStorm from './components/ForceGraphStorm';
import ControlPanel from './components/ControlPanel';

export type VersionType = 'cyberpunk' | 'organic' | 'storm';

export default function App() {
  const [version, setVersion] = useState<VersionType>('storm');
  const [selectedMeeting, setSelectedMeeting] = useState<string | 'all'>('all');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  const handleNodeClick = (node: any) => {
    if (focusNodeId === node.id) {
      setFocusNodeId(null);
    } else {
      setFocusNodeId(node.id);
    }
  };

  const bg = version === 'storm' ? '#faf9f7' : '#000';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: bg }}>
      {version === 'cyberpunk' && (
        <ForceGraphCyberpunk
          focusNodeId={focusNodeId}
          selectedMeeting={selectedMeeting}
          onNodeClick={handleNodeClick}
        />
      )}
      {version === 'organic' && (
        <ForceGraphOrganic
          focusNodeId={focusNodeId}
          selectedMeeting={selectedMeeting}
          onNodeClick={handleNodeClick}
        />
      )}
      {version === 'storm' && (
        <ForceGraphStorm
          focusNodeId={focusNodeId}
          selectedMeeting={selectedMeeting}
          onNodeClick={handleNodeClick}
        />
      )}

      {version !== 'storm' && (
        <ControlPanel
          version={version}
          setVersion={setVersion}
          selectedMeeting={selectedMeeting}
          setSelectedMeeting={setSelectedMeeting}
          focusNodeId={focusNodeId}
          setFocusNodeId={setFocusNodeId}
        />
      )}
    </div>
  );
}