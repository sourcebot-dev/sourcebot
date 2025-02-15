import { ErrorCode } from "@/lib/errorCodes";
import { verifyCredentialsRequestSchema } from "@/lib/schemas";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { User as NextAuthUser } from "next-auth";
import bcrypt from 'bcrypt';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    const body = await request.json();
    const parsed = await verifyCredentialsRequestSchema.safeParseAsync(body);

    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        )
    }

    const { email, password } = parsed.data;
    const user = await getOrCreateUser(email, password);

    if (!user) {
        return serviceErrorResponse(
            {
                statusCode: 401,
                errorCode: ErrorCode.INVALID_CREDENTIALS,
                message: 'Invalid email or password',
            }
        )
    }

    return Response.json(user);
}

async function getOrCreateUser(email: string, password: string): Promise<NextAuthUser | null> {
    const user = await prisma.user.findUnique({
        where: { email }
    });

    // The user doesn't exist, so create a new one.
    if (!user) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = await prisma.user.create({
            data: {
                email,
                hashedPassword,
            }
        });

        return {
            id: newUser.id,
            email: newUser.email,
        }

    // Otherwise, the user exists, so verify the password.
    } else {
        if (!user.hashedPassword) {
            return null;
        }

        if (!bcrypt.compareSync(password, user.hashedPassword)) {
            return null;
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
        };
    }

}