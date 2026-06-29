import { describe, expect, test, vi } from 'vitest';

// The tool's description is bundled from a .txt file, and the logger pulls in
// @sourcebot/shared; neither is relevant here, so both are stubbed.
vi.mock('./readAttachment.txt', () => ({ default: 'Read an attachment.' }));
vi.mock('./logger', () => ({ logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } }));

import { readAttachmentDefinition } from './readAttachment';

describe('read_attachment tool', () => {
    test('reads content, numbers lines, and emits an attachment source', async () => {
        const result = await readAttachmentDefinition.execute(
            { attachmentId: 'a1' },
            {
                getAttachment: (id) =>
                    id === 'a1' ? { filename: 'log.txt', mediaType: 'text/plain', text: 'foo\nbar' } : undefined,
            },
        );

        expect(result.output).toContain('<filename>log.txt</filename>');
        expect(result.output).toContain('<media-type>text/plain</media-type>');
        expect(result.output).toContain('1: foo');
        expect(result.output).toContain('2: bar');
        expect(result.metadata).toMatchObject({
            attachmentId: 'a1',
            filename: 'log.txt',
            mediaType: 'text/plain',
            startLine: 1,
            endLine: 2,
            isTruncated: false,
        });
        expect(result.sources).toEqual([
            { type: 'attachment', attachmentId: 'a1', name: 'log.txt', mediaType: 'text/plain' },
        ]);
    });

    test('throws when the attachment id is unknown', async () => {
        await expect(
            readAttachmentDefinition.execute({ attachmentId: 'missing' }, { getAttachment: () => undefined }),
        ).rejects.toThrow(/not found/);
    });

    test('throws when no attachment resolver is available', async () => {
        await expect(
            readAttachmentDefinition.execute({ attachmentId: 'a1' }, {}),
        ).rejects.toThrow(/not found/);
    });
});
