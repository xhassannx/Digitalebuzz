import type { Edge, Node } from "reactflow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlowVariablePicker } from "@/components/flow-variable-picker";
import { appendFlowVariable } from "@/lib/flow-variable-utils";
import { ContactFlowVariableChips } from "@/components/flow-contact-variable-chips";

type FlowFieldWithVariablesProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  nodes: Node[];
  edges: Edge[];
  currentNodeId: string;
  contextLabel: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
  showContactChips?: boolean;
};

export function FlowFieldWithVariables({
  id,
  label,
  value,
  onChange,
  nodes,
  edges,
  currentNodeId,
  contextLabel,
  placeholder,
  helpText,
  required,
  multiline,
  rows = 4,
  mono,
  showContactChips,
}: FlowFieldWithVariablesProps) {
  const insert = (snippet: string) => onChange(appendFlowVariable(value, snippet));

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <Label htmlFor={id} className="text-xs text-gray-600">
          {label}
          {required ? " *" : ""}
        </Label>
        <FlowVariablePicker
          nodes={nodes}
          edges={edges}
          currentNodeId={currentNodeId}
          contextLabel={contextLabel}
          className="h-7 shrink-0"
          onInsert={insert}
        />
      </div>
      {multiline ? (
        <textarea
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}
        />
      ) : (
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-9 ${mono ? "font-mono text-sm" : ""}`}
        />
      )}
      {helpText ? <p className="text-xs text-gray-500 mt-1">{helpText}</p> : null}
      {showContactChips ? (
        <div className="mt-2">
          <ContactFlowVariableChips onInsert={onChange} />
        </div>
      ) : null}
    </div>
  );
}
