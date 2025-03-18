import winston, { format } from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import { env } from './env.js';

const { combine, colorize, timestamp, prettyPrint, errors, printf, label: labelFn } = format;


const createLogger = (label: string) => {
    return winston.createLogger({
        level: env.SOURCEBOT_LOG_LEVEL,
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