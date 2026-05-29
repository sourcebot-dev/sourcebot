import { ErrorCode } from '@/lib/errorCodes';
import { ServiceError } from '@/lib/serviceError';
import { OAUTH_NOT_SUPPORTED_ERROR_MESSAGE } from '@/ee/features/oauth/constants';
import { StatusCodes } from 'http-status-codes';

export const oauthNotSupported = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: OAUTH_NOT_SUPPORTED_ERROR_MESSAGE,
});
