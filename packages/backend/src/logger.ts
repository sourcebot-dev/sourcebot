import winston, { format } from 'winston';
import { SOURCEBOT_LOG_LEVEL } from './environment.js';

const { combine, colorize, timestamp, prettyPrint, errors, printf, label: labelFn } = format;

const createLogger = (label: string) => {
    return winston.createLogger({
        level: SOURCEBOT_LOG_LEVEL,
        format: combine(
            errors({ stack: true }),
            timestamp(),
            prettyPrint(),
            labelFn({
                label: label,
            })
        ),
        transports: [
            new winston.transports.Console({
                format: combine(
                    errors({ stack: true }),
                    colorize(),
                    printf(({ level, message, timestamp, stack, label: _label }) => {
                        const label = `[${_label}] `;
                        if (stack) {
                            return `${timestamp} ${level}: ${label}${message}\n${stack}`;
                        }
                        return `${timestamp} ${level}: ${label}${message}`;
                    }),
                ),
            }),
        ]
    });
}

export {
    createLogger
};