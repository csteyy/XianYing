import React from 'react';
import { Layers, Activity, Users, Clock, X } from 'lucide-react';
import { complexMockData, allMeetings } from '../data/mockData';

import type { VersionType } from '../App';

interface ControlPanelProps {
  version: VersionType;
  setVersion: (v: VersionType) => void;
  selectedMeeting: string | 'all';
  setSelectedMeeting: (m: string | 'all') => void;
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;
}

export default function ControlPanel({
  version, setVersion,
  selectedMeeting, setSelectedMeeting,
  focusNodeId, setFocusNodeId
}: ControlPanelProps) {
  
  return (
    <div style={{
      position: 'absolute',
      bottom: 'env(safe-area-inset-bottom, 20px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '95%',
      maxWidth: '500px',
      backgroundColor: 'rgba(10, 10, 15, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 20px',
      gap: '16px',
      zIndex: 10,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
    }}>
      
      {/* 顶部显示当前状态 / 取消 Focus */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
          {focusNodeId ? `FOCUS MODE: ${focusNodeId}` : 'NETWORK OVERVIEW'}
        </div>
        {focusNodeId && (
          <button 
            onClick={() => setFocusNodeId(null)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              padding: '4px 8px',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <X size={12} /> CLEAR FOCUS
          </button>
        )}
      </div>

      {/* 控制组 */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        
        {/* 版本切换 */}
        <ControlGroup label="THEME" icon={<Layers size={14} />}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px' }}>
            <TabButton active={version === 'storm'} onClick={() => setVersion('storm')}>STORM</TabButton>
            <TabButton active={version === 'cyberpunk'} onClick={() => setVersion('cyberpunk')}>CYBER</TabButton>
            <TabButton active={version === 'organic'} onClick={() => setVersion('organic')}>ORGANIC</TabButton>
          </div>
        </ControlGroup>

        {/* 会议过滤 */}
        <ControlGroup label="MEETING" icon={<Clock size={14} />}>
          <select 
            value={selectedMeeting} 
            onChange={(e) => setSelectedMeeting(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all" style={{ background: '#000' }}>All Sessions</option>
            {allMeetings.map(m => (
              <option key={m} value={m} style={{ background: '#000' }}>{m.toUpperCase()}</option>
            ))}
          </select>
        </ControlGroup>
        
        {/* 人员聚焦快速选择 (选做，图上点击也可 focus) */}
        <ControlGroup label="PEOPLE" icon={<Users size={14} />}>
          <select 
            value={focusNodeId || ''} 
            onChange={(e) => setFocusNodeId(e.target.value === '' ? null : e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '80px'
            }}
          >
            <option value="" style={{ background: '#000' }}>None</option>
            {complexMockData.nodes.map(n => (
              <option key={n.id} value={n.id} style={{ background: '#000' }}>{n.name}</option>
            ))}
          </select>
        </ControlGroup>

      </div>
    </div>
  );
}

function ControlGroup({ label, icon, children }: { label: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
        border: 'none',
        borderRadius: '6px',
        padding: '4px 8px',
        fontSize: '10px',
        fontWeight: active ? 'bold' : 'normal',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      {children}
    </button>
  );
}