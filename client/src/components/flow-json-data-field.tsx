import type { Edge, Node } from "reactflow";
import { Label } from "@/components/ui/label";
import { FlowVariablePicker } from "@/components/flow-variable-picker";
import { appendFlowVariable } from "@/lib/flow-variable-utils";

type FlowJsonDataFieldProps = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  nodes: Node[];
  edges: Edge[];
  currentNodeId: string;
  rows?: number;
  placeholder?: string;
  helpText?: string;
};

export function FlowJsonDataField({
  id,
  label = "Data",
  value,
  onChange,
  nodes,
  edges,
  currentNodeId,
  rows = 6,
  placeholder = '{"key": "value"}',
  helpText = "Valid JSON. Use Insert variable for trigger or earlier-step values — they become {{...}} tokens replaced at run time.",
}: FlowJsonDataFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <Label htmlFor={id} className="text-xs text-gray-600">
          {label}
        </Label>
        <FlowVariablePicker
          nodes={nodes}
          edges={edges}
          currentNodeId={currentNodeId}
          contextLabel="JSON body"
          className="h-7 shrink-0"
          onInsert={(snippet) => onChange(appendFlowVariable(value, snippet))}
        />
      </div>
      <textarea
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
      />
      <p className="text-xs text-gray-500 mt-1">{helpText}</p>
    </div>
  );
}
