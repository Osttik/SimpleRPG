import { gameState } from './modules/game_module/game_state';
import { MapComponent } from './modules/map_module';
import { MenuModal } from './modules/menu_module';
import { useMenuActions, useMenuSelections } from './store/slices/menu.slice';
import { useState, useEffect } from 'react';

const PingDisplay = () => {
  const [ping, setPing] = useState(gameState.ping);
  
  useEffect(() => {
    const interval = setInterval(() => setPing(gameState.ping), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontSize: '14px',
      textShadow: '1px 1px 2px black',
      zIndex: 1000,
      pointerEvents: 'none',
      backgroundColor: 'rgba(0,0,0,0.4)',
      padding: '4px 8px',
      borderRadius: '4px'
    }}>
      PING: {ping}ms
    </div>
  );
};

function App() {
  const { setMenuState } = useMenuActions();
  const { isMenuOpen } = useMenuSelections();

  return (
    <>
      <MapComponent />
      <PingDisplay />
      <MenuModal />
      
      {/* Burger Menu Button */}
      <button 
        onClick={() => setMenuState(!isMenuOpen)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '5px',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
      >
        <div style={{ width: '22px', height: '2px', backgroundColor: 'white', borderRadius: '1px' }}></div>
        <div style={{ width: '22px', height: '2px', backgroundColor: 'white', borderRadius: '1px' }}></div>
        <div style={{ width: '22px', height: '2px', backgroundColor: 'white', borderRadius: '1px' }}></div>
      </button>
    </>
  );
}

export default App
