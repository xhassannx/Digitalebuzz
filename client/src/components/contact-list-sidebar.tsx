import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chat } from "@shared/schema";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChatListSkeleton } from "./chat-skeleton";
import { getPastelColorForName, cn } from "@/lib/utils";
import { formatUnreadBadgeLabel } from "@/lib/format-unread-badge";

interface ContactListSidebarProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat: (chatId: string) => void;
  isLoading?: boolean;
}

export function ContactListSidebar({ chats, selectedChatId, onSelectChat, isLoading }: ContactListSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = chats.filter(chat =>
    chat.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.contactNumber.includes(searchQuery)
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-80 border-r flex flex-col h-full bg-card" data-testid="sidebar-contacts">
      <div className="p-4 border-b space-y-3">
        <h2 className="font-semibold text-lg">Chats</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-9 h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-contacts"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <ChatListSkeleton />
        ) : (
          <div className="divide-y">
            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-sm mb-2">
                  {chats.length === 0 
                    ? "No conversations yet" 
                    : `No chats match "${searchQuery}"`}
                </p>
                {chats.length === 0 && (
                  <p className="text-xs mt-2">
                    Chats will appear here once you receive or send messages
                  </p>
                )}
              </div>
            ) : (
              filteredChats.map((chat) => {
                const pastelColor = getPastelColorForName(chat.contactName);
                return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full h-16 px-4 flex items-center gap-3 text-left transition-colors ${
                    selectedChatId === chat.id 
                      ? 'bg-accent' 
                      : 'hover:bg-[#b8b8b8] dark:hover:bg-muted/80'
                  }`}
                  data-testid={`button-chat-${chat.id}`}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      {chat.contactProfilePic ? (
                        <AvatarImage src={chat.contactProfilePic} alt={chat.contactName} />
                      ) : null}
                      <AvatarFallback 
                        className={cn("text-sm font-bold", pastelColor.bg, pastelColor.text)}
                        style={{ backgroundColor: pastelColor.bgStyle, color: pastelColor.textStyle }}
                      >
                        {getInitials(chat.contactName)}
                      </AvatarFallback>
                    </Avatar>
                    {/* WhatsApp icon overlay */}
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-[#25d366] rounded-full flex items-center justify-center border-2 border-white dark:border-card p-0.5">
                      <svg viewBox="0 0 24 24" className="h-full w-full text-white fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-1.123-2.03-1.25-.272-.128-.47-.191-.669.191-.198.382-.768 1.25-.941 1.507-.173.256-.347.29-.644.097-.297-.191-1.253-.463-2.386-1.475-.881-.788-1.477-1.761-1.65-2.056-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                    </div>
                    {chat.unreadCount > 0 && (
                      <Badge 
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full text-xs"
                        data-testid={`badge-unread-${chat.id}`}
                      >
                        {formatUnreadBadgeLabel(chat.unreadCount)}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="font-bold truncate text-sm text-[#111b21] dark:text-foreground" data-testid={`text-contact-name-${chat.id}`}>
                        {chat.contactName}
                      </p>
                      {chat.lastMessageTime && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(chat.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    {chat.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate" data-testid={`text-last-message-${chat.id}`}>
                        {chat.lastMessage}
                      </p>
                    )}
                  </div>
                </button>
                );
              })
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
