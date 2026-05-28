"use client";

import { useState, useRef, useEffect } from "react";

interface StreamLog {
  stage: string;
  status: "started" | "completed" | "failed" | "repairing" | "log";
  message: string;
  data?: any;
  timestamp: string;
  latencyMs?: number;
}

interface StageProgress {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  latencyMs?: number;
  issues?: number;
}

export default function Home() {
  const [prompt, setPrompt] = useState("A SaaS platform for freelancers to track billable hours and automatically invoice clients via Stripe.");
  const [logs, setLogs] = useState<StreamLog[]>([]);
  const [finalSpec, setFinalSpec] = useState<any>(null);
  const [stageProgress, setStageProgress] = useState<StageProgress[]>([
    { name: "Stage 1: Intent", status: "pending" },
    { name: "Stage 2: Schema", status: "pending" },
    { name: "Stage 3: AppSpec", status: "pending" },
  ]);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"output" | "errors" | "integrations">("output");
  const [isLoading, setIsLoading] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const updateStageProgress = (stage: string, status: StageProgress["status"], latencyMs?: number, issues?: number) => {
    setStageProgress((prev) =>
      prev.map((s) =>
        s.name.toLowerCase().includes(stage.toLowerCase())
          ? { ...s, status, latencyMs, issues }
          : s
      )
    );
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setLogs([]);
    setFinalSpec(null);
    setValidationErrors([]);
    setStageProgress([
      { name: "Stage 1: Intent", status: "pending" },
      { name: "Stage 2: Schema", status: "pending" },
      { name: "Stage 3: AppSpec", status: "pending" },
    ]);

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() || "";

        for (const msg of messages) {
          if (msg.startsWith("data: ")) {
            try {
              const jsonStr = msg.replace("data: ", "").trim();
              if (!jsonStr) continue;
              
              const parsedEvent = JSON.parse(jsonStr);
              const logEntry: StreamLog = {
                ...parsedEvent,
                timestamp: new Date().toLocaleTimeString(),
              };

              setLogs((prev) => [...prev, logEntry]);

              // Update stage progress
              if (parsedEvent.stage?.includes("Stage")) {
                const stageName = parsedEvent.stage;
                if (parsedEvent.status === "started") {
                  updateStageProgress(stageName, "running");
                } else if (parsedEvent.status === "completed") {
                  updateStageProgress(stageName, "completed", parsedEvent.data?.latencyMs);
                } else if (parsedEvent.status === "failed") {
                  updateStageProgress(stageName, "failed");
                } else if (parsedEvent.status === "repairing") {
                  setValidationErrors((prev) => [...prev, ...((parsedEvent.data as any[]) || [])]);
                }
              }

              if (parsedEvent.stage === "System" && parsedEvent.status === "completed" && parsedEvent.data) {
                setFinalSpec(parsedEvent.data);
              }
            } catch (e) {
              console.error("Failed to parse SSE chunk:", msg);
            }
          }
        }
      }
    } catch (error: any) {
      setLogs((prev) => [
        ...prev,
        {
          stage: "System",
          status: "failed",
          message: `Frontend Error: ${error.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: StageProgress["status"]) => {
    const styles: Record<string, string> = {
      pending: "bg-gray-700 text-gray-300",
      running: "bg-blue-600 text-white animate-pulse",
      completed: "bg-green-600 text-white",
      failed: "bg-red-600 text-white",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  // Render formatted AppSpec output (NOT raw JSON)
  const renderFormattedSpec = () => {
    if (!finalSpec) return null;
    
    return (
      <div className="space-y-6">
        {/* App Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-bold text-white mb-2">{finalSpec.intent?.appName}</h3>
          <p className="text-gray-300 text-sm">{finalSpec.intent?.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {finalSpec.intent?.coreEntities?.map((entity: string) => (
              <span key={entity} className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-xs">
                {entity}
              </span>
            ))}
          </div>
        </div>

        {/* Entities & Fields Table */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-bold text-white mb-3">📊 Data Entities</h4>
          <div className="space-y-4">
            {finalSpec.schema?.tables?.map((table: any) => (
              <div key={table.name} className="border border-gray-700 rounded p-3">
                <h5 className="font-semibold text-blue-300">{table.name}</h5>
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="pb-1">Field</th>
                      <th className="pb-1">Type</th>
                      <th className="pb-1">Key</th>
                      <th className="pb-1">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.fields?.map((field: any) => (
                      <tr key={field.name} className="border-t border-gray-700">
                        <td className="py-1 text-gray-200">{field.name}</td>
                        <td className="py-1 text-gray-400">{field.type}</td>
                        <td className="py-1">{field.isPrimaryKey && <span className="text-yellow-400">🔑</span>}</td>
                        <td className="py-1">{field.isRequired ? "✓" : "○"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        {/* UI Views */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-bold text-white mb-3">🖥️ UI Views</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finalSpec.uiViews?.map((view: any) => (
              <div key={view.name} className="border border-gray-700 rounded p-3">
                <h5 className="font-semibold text-green-300">{view.name}</h5>
                <p className="text-gray-400 text-xs mb-2">{view.description}</p>
                <div className="flex flex-wrap gap-1">
                  {view.components?.map((comp: any) => (
                    <span key={comp.id} className="px-2 py-0.5 bg-purple-900 text-purple-200 rounded text-xs">
                      {comp.type}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflows & Integrations */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-bold text-white mb-3">⚙️ Workflows & Integrations</h4>
          <div className="space-y-3">
            {finalSpec.workflows?.map((workflow: any) => (
              <div key={workflow.name} className="border border-gray-700 rounded p-3">
                <h5 className="font-semibold text-orange-300">{workflow.name}</h5>
                <p className="text-gray-400 text-xs mb-2">
                  Trigger: {workflow.trigger?.type} on {workflow.trigger?.sourceTable}
                </p>
                <div className="space-y-1">
                  {workflow.actions?.map((action: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-cyan-900 text-cyan-200 rounded">
                        {action.integration}
                      </span>
                      <span className="text-gray-300">{action.operation}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raw JSON Toggle (for debugging) */}
        <details className="bg-gray-800 rounded-lg p-4">
          <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
            🔍 View Raw JSON (for debugging)
          </summary>
          <pre className="mt-3 text-xs text-green-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {JSON.stringify(finalSpec, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white">OneAtlas AI Pipeline</h1>
        <p className="text-gray-400 mb-6 text-sm">Multi-Stage AppSpec Generator with Validation & Repair</p>

        {/* Input Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 md:p-6 mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Application Prompt
          </label>
          <textarea
            className="w-full bg-gray-950 border border-gray-700 rounded-md p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none h-20 md:h-24 resize-none text-sm"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-2 md:py-3 px-4 rounded-md transition-colors text-sm"
          >
            {isLoading ? "Pipeline Running..." : "Generate AppSpec"}
          </button>
        </div>

        {/* Stage Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {stageProgress.map((stage) => (
            <div key={stage.name} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-sm">{stage.name}</span>
                {getStatusBadge(stage.status)}
              </div>
              {stage.latencyMs && (
                <p className="text-xs text-gray-400">⏱️ {stage.latencyMs}ms</p>
              )}
              {stage.issues !== undefined && stage.issues > 0 && (
                <p className="text-xs text-yellow-400">⚠️ {stage.issues} repairs</p>
              )}
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 border-b border-gray-800">
          {(["output", "errors", "integrations"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab
                  ? "bg-gray-800 text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab === "output" && "📋 AppSpec Output"}
              {tab === "errors" && `⚠️ Errors (${validationErrors.length})`}
              {tab === "integrations" && "🔌 Integrations"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Logs Terminal */}
          <div className="bg-black border border-gray-800 rounded-lg flex flex-col h-[400px] md:h-[500px]">
            <div className="bg-gray-900 px-4 py-2 border-b border-gray-800 rounded-t-lg flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-2 text-xs text-gray-400">pipeline_stream.log</span>
            </div>
            <div 
              ref={logContainerRef}
              className="p-3 md:p-4 overflow-y-auto flex-1 text-xs space-y-1"
            >
              {logs.length === 0 && !isLoading && (
                <p className="text-gray-600 italic">Waiting for pipeline execution...</p>
              )}
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
                  <span className={`font-bold shrink-0 text-[10px] ${
                    log.status === "completed" ? "text-green-400" :
                    log.status === "started" ? "text-blue-400" :
                    log.status === "repairing" ? "text-yellow-400" :
                    log.status === "failed" ? "text-red-400" : "text-gray-300"
                  }`}>
                    [{log.stage}]
                  </span>
                  <span className="text-gray-300 break-all">{log.message}</span>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 animate-pulse">
                  <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className="text-blue-400 font-bold text-[10px]">[SYSTEM]</span>
                  <span className="text-gray-300">Processing...</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Tab Content */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg flex flex-col h-[400px] md:h-[500px]">
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 rounded-t-lg">
              <span className="text-sm font-bold text-gray-300">
                {activeTab === "output" && "Formatted AppSpec"}
                {activeTab === "errors" && "Validation & Repair Log"}
                {activeTab === "integrations" && "Integration Registry"}
              </span>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {activeTab === "output" && (
                finalSpec ? renderFormattedSpec() : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                    <p>Final AppSpec will appear here upon successful completion.</p>
                  </div>
                )
              )}
              
              {activeTab === "errors" && (
                validationErrors.length > 0 ? (
                  <div className="space-y-3">
                    {validationErrors.map((err, i) => (
                      <div key={i} className="bg-red-900/30 border border-red-800 rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-red-400 font-bold text-xs">[{err.type?.toUpperCase()}]</span>
                          <span className="text-gray-400 text-xs">{err.path?.join(".")}</span>
                        </div>
                        <p className="text-red-200 text-sm">{err.message}</p>
                        {err.suggestion && (
                          <p className="text-yellow-300 text-xs mt-1">💡 {err.suggestion}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                    <p>No validation errors. Pipeline completed successfully! ✅</p>
                  </div>
                )
              )}
              
              {activeTab === "integrations" && (
                <div className="space-y-3">
                  {["slack", "stripe", "jira", "github", "gmail", "twilio", "openai"].map((integration) => (
                    <div key={integration} className="bg-gray-800 rounded p-3">
                      <h5 className="font-semibold text-cyan-300 capitalize">{integration}</h5>
                      <p className="text-gray-400 text-xs mt-1">
                        {integration === "stripe" && "Payments, subscriptions, customers"}
                        {integration === "slack" && "Send messages to channels"}
                        {integration === "jira" && "Create and manage issues"}
                        {integration === "github" && "Repository and issue management"}
                        {integration === "gmail" && "Send automated emails"}
                        {integration === "twilio" && "SMS notifications"}
                        {integration === "openai" && "Text generation and embeddings"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}