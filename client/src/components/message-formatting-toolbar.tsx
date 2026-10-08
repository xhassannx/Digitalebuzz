import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline, Strikethrough, Code, Smile } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageFormattingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onFormat: (format: string) => void;
  onEmojiClick?: () => void;
}

// Unicode transformation maps
const unicodeMaps: Record<string, Record<string, string>> = {
  sansserif: {
    'A': '𝖠', 'B': '𝖡', 'C': '𝖢', 'D': '𝖣', 'E': '𝖤', 'F': '𝖥', 'G': '𝖦', 'H': '𝖧', 'I': '𝖨', 'J': '𝖩',
    'K': '𝖪', 'L': '𝖫', 'M': '𝖬', 'N': '𝖭', 'O': '𝖮', 'P': '𝖯', 'Q': '𝖰', 'R': '𝖱', 'S': '𝖲', 'T': '𝖳',
    'U': '𝖴', 'V': '𝖵', 'W': '𝖶', 'X': '𝖷', 'Y': '𝖸', 'Z': '𝖹',
    'a': '𝖺', 'b': '𝖻', 'c': '𝖼', 'd': '𝖽', 'e': '𝖾', 'f': '𝖿', 'g': '𝗀', 'h': '𝗁', 'i': '𝗂', 'j': '𝗃',
    'k': '𝗄', 'l': '𝗅', 'm': '𝗆', 'n': '𝗇', 'o': '𝗈', 'p': '𝗉', 'q': '𝗊', 'r': '𝗋', 's': '𝗌', 't': '𝗍',
    'u': '𝗎', 'v': '𝗏', 'w': '𝗐', 'x': '𝗑', 'y': '𝗒', 'z': '𝗓'
  },
  cursive: {
    'A': '𝒜', 'B': 'ℬ', 'C': '𝒞', 'D': '𝒟', 'E': 'ℰ', 'F': 'ℱ', 'G': '𝒢', 'H': 'ℋ', 'I': 'ℐ', 'J': '𝒥',
    'K': '𝒦', 'L': 'ℒ', 'M': 'ℳ', 'N': '𝒩', 'O': '𝒪', 'P': '𝒫', 'Q': '𝒬', 'R': 'ℛ', 'S': '𝒮', 'T': '𝒯',
    'U': '𝒰', 'V': '𝒱', 'W': '𝒲', 'X': '𝒳', 'Y': '𝒴', 'Z': '𝒵',
    'a': '𝒶', 'b': '𝒷', 'c': '𝒸', 'd': '𝒹', 'e': 'ℯ', 'f': '𝒻', 'g': 'ℊ', 'h': '𝒽', 'i': '𝒾', 'j': '𝒿',
    'k': '𝓀', 'l': '𝓁', 'm': '𝓂', 'n': '𝓃', 'o': 'ℴ', 'p': '𝓅', 'q': '𝓆', 'r': '𝓇', 's': '𝓈', 't': '𝓉',
    'u': '𝓊', 'v': '𝓋', 'w': '𝓌', 'x': '𝓍', 'y': '𝓎', 'z': '𝓏'
  },
  doublestruck: {
    'A': '𝔸', 'B': '𝔹', 'C': 'ℂ', 'D': '𝔻', 'E': '𝔼', 'F': '𝔽', 'G': '𝔾', 'H': 'ℍ', 'I': '𝕀', 'J': '𝕁',
    'K': '𝕂', 'L': '𝕃', 'M': '𝕄', 'N': 'ℕ', 'O': '𝕆', 'P': 'ℙ', 'Q': 'ℚ', 'R': 'ℝ', 'S': '𝕊', 'T': '𝕋',
    'U': '𝕌', 'V': '𝕍', 'W': '𝕎', 'X': '𝕏', 'Y': '𝕐', 'Z': 'ℤ',
    'a': '𝕒', 'b': '𝕓', 'c': '𝕔', 'd': '𝕕', 'e': '𝕖', 'f': '𝕗', 'g': '𝕘', 'h': '𝕙', 'i': '𝕚', 'j': '𝕛',
    'k': '𝕜', 'l': '𝕝', 'm': '𝕞', 'n': '𝕟', 'o': '𝕠', 'p': '𝕡', 'q': '𝕢', 'r': '𝕣', 's': '𝕤', 't': '𝕥',
    'u': '𝕦', 'v': '𝕧', 'w': '𝕨', 'x': '𝕩', 'y': '𝕪', 'z': '𝕫'
  },
  doublestruckAlt: {
    'A': '⍺', 'B': '⍴', 'C': '⊂', 'D': '⊃', 'E': '∈', 'F': '∉', 'G': '∋', 'H': '∌', 'I': '∍', 'J': '∎',
    'K': '∏', 'L': '∐', 'M': '∑', 'N': '−', 'O': '∓', 'P': '∔', 'Q': '∕', 'R': '∖', 'S': '∗', 'T': '⍑',
    'U': '∘', 'V': '∙', 'W': '√', 'X': '∝', 'Y': '∞', 'Z': '∟'
  },
  gothic: {
    'A': '𝔄', 'B': '𝔅', 'C': 'ℭ', 'D': '𝔇', 'E': '𝔈', 'F': '𝔉', 'G': '𝔊', 'H': 'ℌ', 'I': 'ℑ', 'J': '𝔍',
    'K': '𝔎', 'L': '𝔏', 'M': '𝔐', 'N': '𝔑', 'O': '𝔒', 'P': '𝔓', 'Q': '𝔔', 'R': 'ℜ', 'S': '𝔖', 'T': '𝔗',
    'U': '𝔘', 'V': '𝔙', 'W': '𝔚', 'X': '𝔛', 'Y': '𝔜', 'Z': 'ℨ',
    'a': '𝔞', 'b': '𝔟', 'c': '𝔠', 'd': '𝔡', 'e': '𝔢', 'f': '𝔣', 'g': '𝔤', 'h': '𝔥', 'i': '𝔦', 'j': '𝔧',
    'k': '𝔨', 'l': '𝔩', 'm': '𝔪', 'n': '𝔫', 'o': '𝔬', 'p': '𝔭', 'q': '𝔮', 'r': '𝔯', 's': '𝔰', 't': '𝔱',
    'u': '𝔲', 'v': '𝔳', 'w': '𝔴', 'x': '𝔵', 'y': '𝔶', 'z': '𝔷'
  },
  circled: {
    'A': 'Ⓐ', 'B': 'Ⓑ', 'C': 'Ⓒ', 'D': 'Ⓓ', 'E': 'Ⓔ', 'F': 'Ⓕ', 'G': 'Ⓖ', 'H': 'Ⓗ', 'I': 'Ⓘ', 'J': 'Ⓙ',
    'K': 'Ⓚ', 'L': 'Ⓛ', 'M': 'Ⓜ', 'N': 'Ⓝ', 'O': 'Ⓞ', 'P': 'Ⓟ', 'Q': 'Ⓠ', 'R': 'Ⓡ', 'S': 'Ⓢ', 'T': 'Ⓣ',
    'U': 'Ⓤ', 'V': 'Ⓥ', 'W': 'Ⓦ', 'X': 'Ⓧ', 'Y': 'Ⓨ', 'Z': 'Ⓩ',
    'a': 'ⓐ', 'b': 'ⓑ', 'c': 'ⓒ', 'd': 'ⓓ', 'e': 'ⓔ', 'f': 'ⓕ', 'g': 'ⓖ', 'h': 'ⓗ', 'i': 'ⓘ', 'j': 'ⓙ',
    'k': 'ⓚ', 'l': 'ⓛ', 'm': 'ⓜ', 'n': 'ⓝ', 'o': 'ⓞ', 'p': 'ⓟ', 'q': 'ⓠ', 'r': 'ⓡ', 's': 'ⓢ', 't': 'ⓣ',
    'u': 'ⓤ', 'v': 'ⓥ', 'w': 'ⓦ', 'x': 'ⓧ', 'y': 'ⓨ', 'z': 'ⓩ'
  },
  circledDark: {
    'A': '🅐', 'B': '🅑', 'C': '🅒', 'D': '🅓', 'E': '🅔', 'F': '🅕', 'G': '🅖', 'H': '🅗', 'I': '🅘', 'J': '🅙',
    'K': '🅚', 'L': '🅛', 'M': '🅜', 'N': '🅝', 'O': '🅞', 'P': '🅟', 'Q': '🅠', 'R': '🅡', 'S': '🅢', 'T': '🅣',
    'U': '🅤', 'V': '🅥', 'W': '🅦', 'X': '🅧', 'Y': '🅨', 'Z': '🅩'
  },
  squared: {
    'A': '🄰', 'B': '🄱', 'C': '🄲', 'D': '🄳', 'E': '🄴', 'F': '🄵', 'G': '🄶', 'H': '🄷', 'I': '🄸', 'J': '🄹',
    'K': '🄺', 'L': '🄻', 'M': '🄼', 'N': '🄽', 'O': '🄾', 'P': '🄿', 'Q': '🅀', 'R': '🅁', 'S': '🅂', 'T': '🅃',
    'U': '🅄', 'V': '🅅', 'W': '🅆', 'X': '🅇', 'Y': '🅈', 'Z': '🅉'
  },
  squaredDark: {
    'A': '🅰', 'B': '🅱', 'C': '🅲', 'D': '🅳', 'E': '🅴', 'F': '🅵', 'G': '🅶', 'H': '🅷', 'I': '🅸', 'J': '🅹',
    'K': '🅺', 'L': '🅻', 'M': '🅼', 'N': '🅽', 'O': '🅾', 'P': '🅿', 'Q': '🆀', 'R': '🆁', 'S': '🆂', 'T': '🆃',
    'U': '🆄', 'V': '🆅', 'W': '🆆', 'X': '🆇', 'Y': '🆈', 'Z': '🆉'
  }
};

function transformText(text: string, style: string): string {
  const map = unicodeMaps[style];
  if (!map) return text;
  
  return text.split('').map(char => map[char] || char).join('');
}

interface MessageFormattingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onFormat: (format: string) => void;
  onEmojiClick?: () => void;
}

export function MessageFormattingToolbar({ textareaRef, onFormat, onEmojiClick }: MessageFormattingToolbarProps) {
  const applyFormat = (formatType: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);

    let formattedText = '';
    let newCursorPos = start;

    // Unicode text transformations
    const unicodeStyles = ['sansserif', 'cursive', 'doublestruck', 'doublestruckAlt', 'gothic', 'circled', 'circledDark', 'squared', 'squaredDark'];
    
    if (unicodeStyles.includes(formatType)) {
      if (selectedText) {
        formattedText = transformText(selectedText, formatType);
        newCursorPos = start + formattedText.length;
      } else {
        // If no text selected, insert a sample character
        const sampleChar = formatType === 'sansserif' ? '𝖳' :
                          formatType === 'cursive' ? '𝒯' :
                          formatType === 'doublestruck' ? '𝕋' :
                          formatType === 'doublestruckAlt' ? '⍑' :
                          formatType === 'gothic' ? '𝔗' :
                          formatType === 'circled' ? 'Ⓣ' :
                          formatType === 'circledDark' ? '🅣' :
                          formatType === 'squared' ? '🅃' : '🆃';
        formattedText = sampleChar;
        newCursorPos = start + formattedText.length;
      }
    } else {
      switch (formatType) {
        case 'bold':
          if (selectedText) {
            formattedText = `*${selectedText}*`;
            newCursorPos = start + formattedText.length;
          } else {
            formattedText = '**';
            newCursorPos = start + 1;
          }
          break;
        case 'italic':
          if (selectedText) {
            formattedText = `_${selectedText}_`;
            newCursorPos = start + formattedText.length;
          } else {
            formattedText = '__';
            newCursorPos = start + 1;
          }
          break;
        case 'underline':
          if (selectedText) {
            formattedText = `_${selectedText}_`;
            newCursorPos = start + formattedText.length;
          } else {
            formattedText = '__';
            newCursorPos = start + 1;
          }
          break;
        case 'strikeThrough':
        case 'strikethrough':
          if (selectedText) {
            formattedText = `~${selectedText}~`;
            newCursorPos = start + formattedText.length;
          } else {
            formattedText = '~~';
            newCursorPos = start + 1;
          }
          break;
        case 'monospace':
          if (selectedText) {
            formattedText = `\`\`\`${selectedText}\`\`\``;
            newCursorPos = start + formattedText.length;
          } else {
            formattedText = '``````';
            newCursorPos = start + 3;
          }
          break;
        default:
          return;
      }
    }

    const newValue = beforeText + formattedText + afterText;
    
    // Update textarea value directly for immediate feedback
    textarea.value = newValue;
    
    // Update form value
    onFormat(newValue);
    
    // Restore cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-background justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => applyFormat('bold')}
              data-testid="format-bold"
            >
              <Bold className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Bold (*text*)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => applyFormat('italic')}
              data-testid="format-italic"
            >
              <Italic className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Italic (_text_)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => applyFormat('underline')}
              data-testid="format-underline"
            >
              <Underline className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Underline (_text_)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => applyFormat('strikeThrough')}
              data-testid="format-strikethrough"
            >
              <Strikethrough className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Strikethrough (~text~)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg"
              onClick={() => applyFormat('sansserif')}
              data-testid="format-sansserif"
            >
              𝖳
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sans Serif</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg"
              onClick={() => applyFormat('cursive')}
              data-testid="format-cursive"
            >
              𝒯
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cursive</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg"
              onClick={() => applyFormat('doublestruck')}
              data-testid="format-doublestruck"
            >
              𝕋
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Doublestruck</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg"
              onClick={() => applyFormat('doublestruckAlt')}
              data-testid="format-doublestruck-alt"
            >
              ⍑
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Doublestruck 2</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg font-light"
              onClick={() => applyFormat('gothic')}
              data-testid="format-gothic"
            >
              𝔗
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Gothic</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg font-light"
              onClick={() => applyFormat('circled')}
              data-testid="format-circled"
            >
              Ⓣ
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Circled</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg font-light"
              onClick={() => applyFormat('circledDark')}
              data-testid="format-circled-dark"
            >
              🅣
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Circled Negative</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg font-light"
              onClick={() => applyFormat('squared')}
              data-testid="format-squared"
            >
              🅃
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Squared</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg font-light"
              onClick={() => applyFormat('squaredDark')}
              data-testid="format-squared-dark"
            >
              🆃
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Squared Negative</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-lg"
              onClick={onEmojiClick}
              data-testid="format-emoji"
            >
              😊
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Emoji</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

