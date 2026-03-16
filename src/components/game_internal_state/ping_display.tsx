import { useEffect, useState } from "react";
import { gameState } from "../../modules/game_module/game_state";

export const PingDisplay = () => {
  const [ping, setPing] = useState(gameState.ping);

  useEffect(() => {
    const interval = setInterval(() => setPing(gameState.ping), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p>PING: {ping}</p>
  );
};
