import React, { createContext, useContext, useState } from "react";

interface BotContextType {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggleOpen: () => void;
}

const BotContext = createContext<BotContextType>({
  open: false,
  setOpen: () => {},
  toggleOpen: () => {},
});

export const useBot = () => useContext(BotContext);

export function BotProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleOpen = () => setOpen((p) => !p);
  return (
    <BotContext.Provider value={{ open, setOpen, toggleOpen }}>
      {children}
    </BotContext.Provider>
  );
}
