import React, { useState } from 'react';
import { Settings, RefreshCw, ZoomIn, Info } from 'lucide-react';

export default function BottomNav() {
  const [active, setActive] = useState('view');

  return (
    <div style={{
      position: 'absolute',
      bottom: 'env(safe-area-inset-bottom, 20px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '400px',
      backgroundColor: 'rgba(20, 20, 30, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '12px 20px',
      zIndex: 10,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
    }}>
      <NavButton 
        icon={<ZoomIn size={24} />} 
        label="探索" 
        isActive={active === 'view'} 
        onClick={() => setActive('view')} 
      />
      <NavButton 
        icon={<RefreshCw size={24} />} 
        label="重置" 
        isActive={active === 'reset'} 
        onClick={() => {
          setActive('reset');
          setTimeout(() => setActive('view'), 200);
          // TODO: Reset Camera
        }} 
      />
      <NavButton 
        icon={<Info size={24} />} 
        label="详情" 
        isActive={active === 'info'} 
        onClick={() => setActive('info')} 
      />
      <NavButton 
        icon={<Settings size={24} />} 
        label="设置" 
        isActive={active === 'settings'} 
        onClick={() => setActive('settings')} 
      />
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        transition: 'color 0.2s',
        padding: '0 8px'
      }}
    >
      <div style={{
        transform: isActive ? 'scale(1.1)' : 'scale(1)',
        transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        {icon}
      </div>
      <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400 }}>{label}</span>
    </button>
  );
}