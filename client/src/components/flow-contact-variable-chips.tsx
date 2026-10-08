const CONTACT_FLOW_VARIABLES = [
  { label: "Contact phone", snippet: "{{contact.phone}}" },
  { label: "Phone (E.164)", snippet: "{{contact.phoneE164}}" },
  { label: "Contact name", snippet: "{{contact.name}}" },
  { label: "First name", snippet: "{{contact.firstName}}" },
  { label: "Email", snippet: "{{contact.email}}" },
] as const;

export function ContactFlowVariableChips({ onInsert }: { onInsert: (snippet: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CONTACT_FLOW_VARIABLES.map((v) => (
        <button
          key={v.snippet}
          type="button"
          className="nodrag nopan text-xs px-2 py-1 rounded-md border border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100"
          onClick={() => onInsert(v.snippet)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
