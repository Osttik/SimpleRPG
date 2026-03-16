import { classNames } from "primereact/utils";
import { PingDisplay } from "./ping_display";

interface IProps {
  className?: string;
}

export const GameInternalState = ({
  className,
}: IProps) => {
  return (
    <div className={classNames(className, "pointer-events-none rounded bg-black/40 px-2 py-1 font-mono text-sm text-[#00ff00] [text-shadow:_1px_1px_2px_black]")}>
      <PingDisplay />
    </div>
  );
};
