import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    
    // Call your Railway backend
    const response = await fetch(
      "https://landrover-rag-production.up.railway.app/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: lastMessage.content,
          conversation_history: messages.slice(0, -1).map((m: any) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      }
    );

    const data = await response.json();

    // Return in the format the UI expects
    return Response.json({
      role: "assistant",
      content: data.answer,
      sources: data.sources,
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new ChatSDKError("offline:chat").toResponse();
  }
}
