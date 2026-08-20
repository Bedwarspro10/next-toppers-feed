import React, { createContext, useContext, useState } from "react";

interface PremiumModalContextType {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const PremiumModalContext = createContext<PremiumModalContextType>({
  open: false,
  setOpen: () => {},
});

export const usePremiumModal = () => useContext(PremiumModalContext);

export function PremiumModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PremiumModalContext.Provider value={{ open, setOpen }}>
      {children}
    </PremiumModalContext.Provider>
  );
}
