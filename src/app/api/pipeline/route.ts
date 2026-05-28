import { PipelineOrchestrator } from "@/lib/pipeline/orchestrator";
import { SSEStreamer } from "@/lib/pipeline/stream";

export const dynamic = "force-dynamic"; // Required for streaming in Next.js App Router

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
  }

  // Create a ReadableStream for Server-Sent Events (SSE)
  const stream = new ReadableStream({
    async start(controller) {
      const streamer = new SSEStreamer(controller);

      try {
        streamer.send({ stage: "System", status: "started", message: "Initializing AI Pipeline..." });
        
        const orchestrator = new PipelineOrchestrator(streamer);
        const finalSpec = await orchestrator.run(prompt);

        streamer.send({ stage: "System", status: "completed", message: "Pipeline finished successfully.", data: finalSpec });
      } catch (error: any) {
        streamer.send({ stage: "System", status: "failed", message: error.message });
      } finally {
        streamer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}