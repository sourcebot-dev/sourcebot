import readline from 'readline-sync';
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('db-utils');

export const confirmAction = (message: string = "Are you sure you want to proceed? [N/y]") => {
    const response = readline.question(message).toLowerCase();
    if (response !== 'y') {
        logger.info("Aborted.");
        process.exit(0);
    }
}

export const abort = () => {
    logger.info("Aborted.");
    process.exit(0);
};
