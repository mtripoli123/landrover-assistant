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

    // Use the format the Vercel AI SDK expects
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send message ID
        controller.enqueue(encoder.encode(`f:{"messageId":"msg_${Date.now()}"}\n`));
        
        // Stream text character by character
        for (let i = 0; i < text.length; i++) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(text[i])}\n`));
          await new Promise(r => setTimeout(r, 10));
        }
        
        // Send finish
        controller.enqueue(encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0},"isContinued":false}\n`));
        controller.enqueue(encoder.encode(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`));
        
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Error: " + String(error), { status: 500 });
  }
}