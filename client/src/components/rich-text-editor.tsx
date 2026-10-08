import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleLink = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const selectedText = selection.toString();
      setLinkText(selectedText);
      setShowLinkDialog(true);
    } else {
      setShowLinkDialog(true);
    }
  };

  const insertLink = () => {
    if (linkUrl) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const link = document.createElement("a");
        link.href = linkUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = linkText || linkUrl;
        
        try {
          range.deleteContents();
          range.insertNode(link);
          onChange(editorRef.current?.innerHTML || "");
          setShowLinkDialog(false);
          setLinkUrl("");
          setLinkText("");
        } catch (e) {
          execCommand("createLink", linkUrl);
        }
      } else {
        execCommand("createLink", linkUrl);
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border rounded-md bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("bold")}
          className="h-8 w-8 p-0"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("italic")}
          className="h-8 w-8 p-0"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("insertUnorderedList")}
          className="h-8 w-8 p-0"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand("insertOrderedList")}
          className="h-8 w-8 p-0"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleLink}
          className="h-8 w-8 p-0"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="p-3 border rounded-md bg-background space-y-2">
          <div>
            <Label className="text-xs">Link Text</Label>
            <Input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Link text"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">URL</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={insertLink}
              className="h-8 text-xs"
            >
              Insert Link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowLinkDialog(false);
                setLinkUrl("");
                setLinkText("");
              }}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        className="min-h-[200px] border rounded-md p-4 bg-background prose prose-slate dark:prose-invert max-w-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        style={{
          whiteSpace: "pre-wrap",
        }}
        data-placeholder={placeholder || "Start typing..."}
        suppressContentEditableWarning
      />
      
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
