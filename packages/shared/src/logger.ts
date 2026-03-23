import winston, { format, Logger } from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import { MESSAGE } from 'triple-beam';
import { env } from './env.server.js';

/**
 * Logger configuration with support for structured JSON logging.
 * 
 * When SOURCEBOT_STRUCTURED_LOGGING_ENABLED=true:
 * - Console output will be in JSON format suitable for Datadog ingestion
 * - Logs will include structured fields: timestamp, level, message, label, stack (if error)
 * 
 * When SOURCEBOT_STRUCTURED_LOGGING_ENABLED=false (default):
 * - Console output will be human-readable with colors
 * - Logs will be formatted as: "timestamp level: [label] message"
 */

const { combine, colorize, timestamp, errors, printf, label: labelFn, json } = format;

const datadogFormat = format((info) => {
    info.status = info.level.toLowerCase();
    info.service = info.label;
    info.label = undefined;

    const msg = info[MESSAGE as unknown as string] as string | undefined;
    if (msg) {
        info.message = msg;
        info[MESSAGE as unknown as string] = undefined;
    }

    return info;
});

const humanReadableFormat = printf(({ level, message, timestamp, stack, label: _label, ...rest }) => {
    const label = `[${_label}] `;
    const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    const base = `${timestamp} ${level}: ${label}${message}${extras}`;
    return stack ? `${base}\n${stack}` : base;
});

const createLogger = (label: string) => {
    const isStructuredLoggingEnabled = env.SOURCEBOT_STRUCTURED_LOGGING_ENABLED === 'true';

    return winston.createLogger({
        level: env.SOURCEBOT_LOG_LEVEL,
        format: combine(
            errors({ stack: true }),
            timestamp(),
            labelFn({ label: label }),
        ),
        transports: [
            new winston.transports.Console({
                format: isStructuredLoggingEnabled
                    ? combine(
                        datadogFormat(),
                        json()
                    )
                    : combine(
                        colorize(),
                        humanReadableFormat
                    ),
            }),
            ...(env.SOURCEBOT_STRUCTURED_LOGGING_FILE && isStructuredLoggingEnabled ? [
                new winston.transports.File({
                    filename: env.SOURCEBOT_STRUCTURED_LOGGING_FILE,
                    format: combine(
                        datadogFormat(),
                        json()
                    ),
                }),
            ] : []),
            ...(env.LOGTAIL_TOKEN && env.LOGTAIL_HOST ? [
                new LogtailTransport(
                    new Logtail(env.LOGTAIL_TOKEN, {
                        endpoint: env.LOGTAIL_HOST,
                    })
                )
            ] : []),
        ]
    });
}

export {
    createLogger
};

export type {
    Logger,
}