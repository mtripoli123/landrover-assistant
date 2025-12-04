export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const messageContent = body.message?.parts?.[0]?.text || "";

    if (!messageContent) {
      return new Response("No message provided", { status: 400 });
    }

    const response = await fetch(
      "https://landrover-rag-production.up.railway.app/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          conversation_history: [],
        }),
      }
    );

    const data = await response.json();
    const text = data.answer || "Sorry, I couldn't find an answer.";

    // Use Server-Sent Events format that the Vercel AI SDK expects
    const encoder = new TextEncoder();
    const messageId = `msg_${Date.now()}`;
    const stream = new ReadableStream({
      async start(controller) {
        // Send start-step
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start-step" })}\n\n`));
        
        // Send text-start
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: messageId })}\n\n`));
        
        // Stream text in chunks (word by word for better UX)
        const words = text.split(/(\s+)/);
        for (const word of words) {
          if (word.trim() || word === " ") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", id: messageId, delta: word })}\n\n`));
            await new Promise(r => setTimeout(r, 20));
          }
        }
        
        // Send text-end
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: messageId })}\n\n`));
        
        // Send finish-step
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish-step" })}\n\n`));
        
        // Send finish
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "finish" })}\n\n`));
        
        // Send done
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Error: " + String(error), { status: 500 });
  }
}