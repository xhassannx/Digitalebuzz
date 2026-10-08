"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ReminderContextValue {
  contactId: string | null;
  onOpenContactDetails?: () => void;
  setReminderContext: (contactId: string | null, onOpenContactDetails?: () => void) => void;
  /** When set, chat page should open this contact's chat and then clear it. Used when user clicks a reminder while already on /chat. */
  pendingContactIdToOpen: string | null;
  setPendingContactIdToOpen: (id: string | null) => void;
}

const ReminderContext = createContext<ReminderContextValue | null>(null);

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [contactId, setContactId] = useState<string | null>(null);
  const [onOpenContactDetails, setOnOpenContactDetails] = useState<(() => void) | undefined>(undefined);
  const [pendingContactIdToOpen, setPendingContactIdToOpen] = useState<string | null>(null);

  const setReminderContext = useCallback(
    (id: string | null, onOpen?: () => void) => {
      setContactId(id);
      setOnOpenContactDetails(() => onOpen);
    },
    []
  );

  return (
    <ReminderContext.Provider
      value={{ contactId, onOpenContactDetails, setReminderContext, pendingContactIdToOpen, setPendingContactIdToOpen }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminderContext() {
  return useContext(ReminderContext);
}
