import { useNavigate } from 'react-router-dom';

export const MainMenu = () => {
  const navigate = useNavigate();

  const handleConnect = () => {
    navigate('/game');
  };

  const handleExit = () => {
    if (window.confirm("Ви впевнені, що хочете вийти?")) {
      window.close();
    }
  };

  return (
    
    <div className="w-screen h-screen flex items-center justify-center bg-neutral-900 text-white">
      <div className="bg-neutral-800 p-12 rounded-xl border-2 border-orange-500 shadow-2xl flex flex-col gap-6 w-96 text-center">
        <h1 className="text-4xl font-bold mb-6 text-orange-400">Simple RPG</h1>
        
        <button 
          onClick={handleConnect}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-colors text-xl border border-green-800 shadow-md"
        >
          Connect
        </button>

        <button 
          onClick={handleExit}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg border border-red-800 shadow-md"
        >
          Leave the game
        </button>
      </div>
    </div>
  );
}