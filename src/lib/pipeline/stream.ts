export interface StreamEvent {
  stage: string;
  status: "started" | "completed" | "failed" | "repairing" | "log";
  message: string;
  data?: any;
}

export class SSEStreamer {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController;

  constructor(controller: ReadableStreamDefaultController) {
    this.controller = controller;
  }

  send(event: StreamEvent) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    this.controller.enqueue(this.encoder.encode(payload));
  }

  close() {
    this.controller.close();
  }
}