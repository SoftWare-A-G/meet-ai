export type Message = {
  id: string;
  roomId: string;
  sender: string;
  sender_type: string;
  content: string;
  color?: string;
};

export type AttachmentMeta = {
  id: string;
  filename: string;
  size: number;
  content_type: string;
};

export interface MeetAiClient {
  createRoom(name: string): Promise<{ id: string; name: string }>;
  sendMessage(roomId: string, sender: string, content: string, color?: string): Promise<Message>;
  getMessages(
    roomId: string,
    options?: { after?: string; exclude?: string; senderType?: string },
  ): Promise<Message[]>;
  listen(
    roomId: string,
    options?: {
      exclude?: string;
      senderType?: string;
      onMessage?: (msg: Message) => void;
    },
  ): WebSocket;
  sendLog(roomId: string, sender: string, content: string, color?: string, messageId?: string): Promise<Message>;
  sendTeamInfo(roomId: string, payload: string): Promise<string>;
  sendTasks(roomId: string, payload: string): Promise<string>;
  getMessageAttachments(roomId: string, messageId: string): Promise<AttachmentMeta[]>;
  downloadAttachment(attachmentId: string): Promise<string>;
  generateKey(): Promise<{ key: string; prefix: string }>;
  deleteRoom(roomId: string): Promise<void>;
}
