export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const lastMessage = messages[messages.length - 1];

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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const text = data.answer || "Sorry, I couldn't find an answer.";
        const words = text.split(" ");
        let i = 0;
        
        const interval = setInterval(() => {
          if (i < words.length) {
            const chunk = (i === 0 ? "" : " ") + words[i];
            controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
            i++;
          } else {
            controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
            controller.close();
            clearInterval(interval);
          }
        }, 30);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Error processing request", { status: 500 });
  }
}