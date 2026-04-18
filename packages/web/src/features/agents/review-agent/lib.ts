import path from "path";
import { env } from "@sourcebot/shared";
import fs from "fs";

export const REVIEW_AGENT_LOG_DIR = env.DATA_CACHE_DIR + "/review-agent";

export const appendReviewAgentLog = (logFileName: string, log: string): void => {
    fs.appendFileSync(path.join(REVIEW_AGENT_LOG_DIR, logFileName), log);
};