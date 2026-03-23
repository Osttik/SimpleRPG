import { useNavigate } from "react-router-dom"; 
import { CoreOverlay } from "../../../../components/overlay";
import { useMenuActions, useMenuSelections } from "../../../../store/slices/menu.slice";

type LangCode = 'UA' | 'EN' | 'PL';

const labels: Record<LangCode, any> = {
  UA: { cont: "Продовжити", quit: "Вийти", conf: "Повернутись до меню?" },
  EN: { cont: "Continue", quit: "Quit", conf: "Back to main menu?" },
  PL: { cont: "Kontynuuj", quit: "Wyjdź", conf: "Powrócić do menu?" }
};

export const MenuModal = () => {
  const { isMenuOpen } = useMenuSelections();
  const { setMenuState } = useMenuActions();
  const navigate = useNavigate();
  const lang = (localStorage.getItem('lang') as LangCode) || 'UA';

  return (
    <CoreOverlay 
      visible={isMenuOpen}
      setVisible={setMenuState}
      content={(
        <div className="flex flex-col gap-8 p-16 items-center bg-transparent border-none shadow-none">
          <button onClick={() => setMenuState(false)} 
            className="rpg-btn text-5xl font-bold uppercase medieval-font cursor-pointer leading-tight">
            {labels[lang].cont}
          </button>
          
          <button onClick={() => { if (window.confirm(labels[lang].conf)) { setMenuState(false); navigate('/'); } }} 
            className="text-red-900 text-4xl font-bold uppercase medieval-font hover:text-red-600 hover:scale-105 transition-all cursor-pointer"
            style={{ textShadow: '2px 2px 6px #000' }}>
            {labels[lang].quit}
          </button>
        </div>
      )}
    />
  );
}