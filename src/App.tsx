import { Routes, Route } from 'react-router-dom';
import { MainMenu } from './modules/menu_module/components/main_menu/index';

import GameScene from './GameScene'; 

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/game" element={<GameScene />} />
    </Routes>
  );
}

export default App;