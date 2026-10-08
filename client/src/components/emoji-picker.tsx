import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

const EMOJI_CATEGORIES = {
  "Smileys": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓"],
  "Gestures": ["👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝"],
  "Objects": ["📱", "💻", "⌨️", "🖥", "🖨", "🖱", "💿", "💾", "📀", "📷", "📸", "📹", "🎥", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙", "🎚", "🎛", "⏱", "⏰", "⏲", "🕰", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯", "🗑", "🛒", "💰", "💴", "💵", "💶", "💷", "💸", "💳", "🧾", "✉️", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳"],
  "Symbols": ["✅", "❌", "❎", "✔️", "☑️", "⭕", "🔴", "🔵", "🟢", "🟡", "🟠", "🟣", "⚫", "⚪", "🟤", "⬛", "⬜", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⭐", "🌟", "✨", "💫", "💥", "💯", "🔥", "⚡", "☀️", "🌙", "⛅", "☁️", "🌈", "⚠️", "🚨", "🔔", "🔕", "📢", "📣"],
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  triggerClassName?: string;
}

export function EmojiPicker({ onEmojiSelect, triggerClassName }: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Smileys");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={triggerClassName}
          data-testid="button-emoji-picker"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b">
          <div className="flex gap-1 p-2 overflow-x-auto">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <Button
                key={category}
                type="button"
                variant={selectedCategory === category ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="text-xs whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1 p-2 max-h-64 overflow-y-auto">
          {EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES].map((emoji, index) => (
            <Button
              key={index}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-xl hover:bg-accent"
              onClick={() => onEmojiSelect(emoji)}
              data-testid={`emoji-${emoji}`}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
