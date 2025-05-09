import Link from "next/link";
import { NavigationMenu } from "../components/navigationMenu";
import { FaCogs } from "react-icons/fa";
import { env } from "@/env.mjs";

const agents = [
  {
    id: "review-agent",
    name: "Review Agent",
    description: "An agent that reviews your PRs. Uses the code indexed on Sourcebot to provide codebase wide context.",
    requiredEnvVars: ["GITHUB_APP_ID", "GITHUB_APP_WEBHOOK_SECRET", "GITHUB_APP_PRIVATE_KEY_PATH", "OPENAI_API_KEY"],
    configureUrl: "https://docs.sourcebot.dev/docs/agents/review-agent"
  },
];

export default function AgentsPage({ params: { domain } }: { params: { domain: string } }) {
  return (
    <div className="flex flex-col items-center overflow-hidden min-h-screen">
      <NavigationMenu domain={domain} />
      <div className="w-full max-w-6xl px-4 mt-12 mb-24">
        <div
          className={
            agents.length === 1
              ? "flex justify-center items-center min-h-[60vh]"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
          }
        >
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={
                agents.length === 1
                  ? "relative flex flex-col items-center border border-border rounded-2xl p-8 bg-card shadow-xl w-full max-w-xl"
                  : "relative flex flex-col items-center border border-border rounded-2xl p-8 bg-card shadow-xl"
              }
            >
              {/* Name and description */}
              <div className="flex flex-col items-center w-full">
                <h2 className="font-bold text-2xl mb-4 mt-2 text-center text-foreground drop-shadow-sm">
                  {agent.name}
                </h2>
                <p className="text-base text-muted-foreground text-center mb-4 min-h-[56px]">
                  {agent.description}
                </p>
              </div>
              {/* Actions */}
              <div className="flex flex-col items-center w-full mt-2">
                {agent.requiredEnvVars.every(envVar => envVar in env && env[envVar as keyof typeof env] !== undefined) ? (
                  <div className="text-green-500 font-semibold">
                    Agent is configured and accepting requests on /api/webhook 
                  </div>
                ) : (
                  <Link
                    href={agent.configureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-mono font-semibold text-base border border-primary shadow-sm hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary/60 transition w-1/2"
                  >
                    <FaCogs className="text-lg" /> Configure
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 