import { ServiceError } from "./types.js";


export const isServiceError = (data: unknown): data is ServiceError => {
    return typeof data === 'object' &&
        data !== null &&
        'statusCode' in data &&
        'errorCode' in data &&
        'message' in data;
}

export class ServiceErrorException extends Error {
    constructor(public readonly serviceError: ServiceError) {
        super(JSON.stringify(serviceError));
    }
}

export const addLineNumbers = (source: string, lineOffset = 1) => {
    return source.split('\n').map((line, index) => `${index + lineOffset}:${line}`).join('\n');
}