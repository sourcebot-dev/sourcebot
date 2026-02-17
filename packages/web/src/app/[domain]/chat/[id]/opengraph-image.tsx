import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { prisma } from '@/prisma';
import { getOrgFromDomain } from '@/data/org';
import { ChatVisibility } from '@sourcebot/db';

export const runtime = 'nodejs';
export const alt = 'Sourcebot Chat';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

interface ImageProps {
    params: Promise<{
        domain: string;
        id: string;
    }>;
}

export default async function Image({ params }: ImageProps) {
    const { domain, id } = await params;

    const org = await getOrgFromDomain(domain);
    if (!org) {
        notFound();
    }

    const chat = await prisma.chat.findUnique({
        where: {
            id,
            orgId: org.id,
        },
        include: {
            createdBy: {
                select: {
                    name: true,
                    image: true,
                },
            },
        },
    });

    // Only generate custom OG images for public chats
    if (!chat || chat.visibility !== ChatVisibility.PUBLIC) {
        notFound();
    }

    const MAX_CHAT_NAME_LENGTH = 40;
    const rawChatName = chat.name ?? 'Untitled chat';
    const chatName = rawChatName.length > MAX_CHAT_NAME_LENGTH
        ? rawChatName.substring(0, MAX_CHAT_NAME_LENGTH).trim() + '...'
        : rawChatName;
    const creatorImage = chat.createdBy?.image;

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#09090b',
                    fontFamily: 'system-ui, sans-serif',
                    padding: '60px',
                    position: 'relative',
                }}
            >
                {/* Thread line */}
                <div
                    style={{
                        position: 'absolute',
                        left: '100px',
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#27272a',
                    }}
                />

                <div
                    style={{
                        position: 'absolute',
                        right: '100px',
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#27272a',
                    }}
                />

                {/* Main content area - both bubbles together */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        justifyContent: 'center',
                        paddingBottom: '40px',
                        gap: '40px',
                    }}
                >
                    {/* Chat bubble */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            border: '2px solid #27272a',
                            borderRadius: '50px 50px 50px 0px',
                            padding: '20px 32px',
                            gap: '20px',
                            marginLeft: '40px',
                        }}
                    >
                        {/* Avatar */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={creatorImage ?? `${process.env.NEXT_PUBLIC_DOMAIN_URL ?? 'http://localhost:3000'}/placeholder_avatar.png`}
                            alt="Avatar"
                            width={80}
                            height={80}
                            style={{
                                borderRadius: '50%',
                                objectFit: 'cover',
                            }}
                        />

                        {/* Chat name */}
                        <span
                            style={{
                                fontSize: '36px',
                                fontWeight: 900,
                                color: '#ffffff',
                            }}
                        >
                            {chatName}
                        </span>
                    </div>

                    {/* Branding bubble */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            alignSelf: 'flex-end',
                            border: '2px solid #27272a',
                            borderRadius: '50px 50px 0px 50px',
                            padding: '20px 32px',
                            gap: '20px',
                            marginRight: '40px',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '36px',
                                fontWeight: 900,
                                color: '#ffffff',
                            }}
                        >
                            sourcebot.dev
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={`${process.env.NEXT_PUBLIC_DOMAIN_URL ?? 'http://localhost:3000'}/sb_logo_dark_small.png`}
                            alt="Sourcebot"
                            width={80}
                            height={80}
                        />
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
