import { vi } from 'vitest';

export const prisma = {
    license: {
        findUnique: vi.fn().mockResolvedValue(null),
    },
};
