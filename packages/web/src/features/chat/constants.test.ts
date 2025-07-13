import { test } from 'vitest'
import { createSystemPrompt } from './constants';


test('createSystemPrompt debug test', () => {
    const prompt = createSystemPrompt({
        repos: ['repo1', 'repo2'],
    });

    console.log(prompt);
});