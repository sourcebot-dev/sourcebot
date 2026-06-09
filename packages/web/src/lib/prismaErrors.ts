import { Prisma } from "@sourcebot/db";

// @see https://www.prisma.io/docs/orm/reference/error-reference#error-codes
const isKnownRequestError = (
    error: unknown,
    code: string,
): error is Prisma.PrismaClientKnownRequestError =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

/**
 * P2002: a unique constraint was violated (e.g. inserting a duplicate row).
 */
export const isUniqueConstraintError = (error: unknown) =>
    isKnownRequestError(error, "P2002");

/**
 * P2025: an operation failed because the record it depends on was not found
 * (e.g. updating or deleting a row that no longer exists).
 */
export const isRecordNotFoundError = (error: unknown) =>
    isKnownRequestError(error, "P2025");
