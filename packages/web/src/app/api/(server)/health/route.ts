'use server';

export const GET = async () => {
    console.log('health check');
    return Response.json({ status: 'ok' });
}

