import { useNavigate } from "react-router-dom"; 
import { CoreOverlay } from "../../../../components/overlay";
import { useMenuActions, useMenuSelections } from "../../../../store/slices/menu.slice";

export const MenuModal = () => {
  const { isMenuOpen } = useMenuSelections();
  const { setMenuState } = useMenuActions();
  const navigate = useNavigate(); 

  return (
    <CoreOverlay 
      visible={isMenuOpen}
      setVisible={setMenuState}
      content={(
        <div className="flex flex-col gap-10 p-12 min-w-[350px] items-center">
          <button 
            onClick={() => setMenuState(false)}
            className="group w-full py-12 rounded-[100px] bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] shadow-[0_0_30px_rgba(139,90,43,0.6),inset_0_8px_16px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_80px_rgba(212,175,55,1),inset_0_10px_25px_rgba(255,255,255,0.6)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_20px_40px_rgba(0,0,0,0.9)]"
          >
            <span 
              className="text-[#f3e5ab] font-bold uppercase tracking-[0.2em] text-4xl transition-all duration-500 group-hover:text-white" 
              style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 6px black, 0 0 15px rgba(255,255,255,0.5)" }}
            >
              Continue
            </span>
          </button>

          <button 
            onClick={() => {
              if (window.confirm('Are you sure you want to quit to the Main Menu?')) {
                setMenuState(false);
                navigate('/');
              }
            }} 
            className="group w-full py-12 rounded-[100px] bg-gradient-to-b from-[#8b5a2b] to-[#4a2e15] shadow-[0_0_30px_rgba(139,90,43,0.6),inset_0_8px_16px_rgba(255,255,255,0.2)] transition-all duration-500 hover:scale-110 hover:shadow-[0_0_80px_rgba(212,175,55,1),inset_0_10px_25px_rgba(255,255,255,0.6)] hover:brightness-125 active:scale-95 active:shadow-[inset_0_20px_40px_rgba(0,0,0,0.9)]"
          >
            <span 
              className="text-[#f3e5ab] font-bold uppercase tracking-[0.2em] text-4xl transition-all duration-500 group-hover:text-white" 
              style={{ fontFamily: "'Almendra', serif", textShadow: "3px 3px 6px black, 0 0 15px rgba(255,255,255,0.5)" }}
            >
              Quit
            </span>
          </button>
        </div>
      )}
    />
  );
}