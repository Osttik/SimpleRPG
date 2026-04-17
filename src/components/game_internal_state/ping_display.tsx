import { useEffect, useState } from "react";
import { gameState } from "../../modules/game_module/game_state";

export const PingDisplay = () => {
  const [ping, setPing] = useState(gameState.ping);
  const [playerZ, setPlayerZ] = useState<number | null>(null);
  const [focusedZ, setFocusedZ] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPing(gameState.ping);
      const myId = gameState.myId;
      setPlayerZ(myId ? gameState.players[myId]?.z ?? null : null);
      const focusedId = gameState.focusedId;
      setFocusedZ(focusedId ? gameState.players[focusedId]?.z ?? null : null);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <p>PING: {ping}</p>
      <p>PLAYER Z: {playerZ ?? 'n/a'}</p>
      <p>FOCUSED Z: {focusedZ ?? 'n/a'}</p>
    </div>
  );
};
