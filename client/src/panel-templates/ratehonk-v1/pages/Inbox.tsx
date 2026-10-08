/**
 * Nova Inbox — Figma node 371:9851
 * https://www.figma.com/design/Ho7aZJvanQlVi88TwsSZjx/Untitled?node-id=371-9851
 */
import ChatPage from "@/pages/chat-page";
import { RatehonkSkinProvider } from "../RatehonkSkinContext";

export default function RatehonkInboxPage() {
  return (
    <RatehonkSkinProvider>
      <div
        className="nova-inbox ratehonk-inbox flex h-full min-h-0 flex-1 flex-col"
        data-ratehonk-page="Inbox"
      >
        <ChatPage />
      </div>
    </RatehonkSkinProvider>
  );
}
