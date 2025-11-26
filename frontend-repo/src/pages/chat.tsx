import React from 'react';
import { ChatAssistant } from '@/components/chat-assistant';

export default function ChatPage() {
  return (
    <div className="container mx-auto py-6 h-[calc(100vh-theme(spacing.16))]">
      <ChatAssistant />
    </div>
  );
}