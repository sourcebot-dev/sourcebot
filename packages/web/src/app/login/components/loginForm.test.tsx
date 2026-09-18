import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('@/hooks/useCaptureEvent', () => ({ default: () => vi.fn() }));
vi.mock('@/features/auth/useIdentityProviders', () => ({ useIdentityProviders: () => [] }));
vi.mock('@/app/components/sourcebotLogo', () => ({ SourcebotLogo: () => null }));
vi.mock('@/app/components/authMethodSelector', () => ({ AuthMethodSelector: () => <div data-testid="sign-in-options">Sign-in options</div> }));
vi.mock('@/lib/utils', () => ({ cn: (...classes: unknown[]) => classes.filter(Boolean).join(' ') }));
const { LoginForm } = await import('./loginForm');
afterEach(cleanup);

test.each(['login', 'signup'] as const)('shows the message above authentication options in %s', (context) => {
    render(<LoginForm context={context} loginMessage="[Request access](https://example.com/access)" />);
    const link = screen.getByRole('link', { name: 'Request access' });
    expect(link.compareDocumentPosition(screen.getByTestId('sign-in-options')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('renders sign-in options when no message is configured', () => {
    render(<LoginForm context="login" loginMessage={null} />);
    expect(screen.getByTestId('sign-in-options')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Request access' })).toBeNull();
});
