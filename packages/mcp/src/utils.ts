import { ServiceError } from "./types.js";


export const isServiceError = (data: unknown): data is ServiceError => {
    return typeof data === 'object' &&
        data !== null &&
        'statusCode' in data &&
        'errorCode' in data &&
        'message' in data;
}