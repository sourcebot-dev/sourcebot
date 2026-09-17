import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LoginMessage } from './loginMessage';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

test('renders formatted access instructions and links that preserve the login tab', () => {
    const { container } = render(<LoginMessage message={'**Before signing in**\n\n- [Request access](https://example.com/access)\n- Contact *IT*'} />);
    expect(container.querySelector('strong')?.textContent).toBe('Before signing in');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    const link = screen.getByRole('link', { name: 'Request access' });
    expect(link.getAttribute('href')).toBe('https://example.com/access');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
});

test.each([null, undefined, '', ' \n '])('renders nothing for an empty message %j', (message) => {
    const { container } = render(<LoginMessage message={message} />);
    expect(container.innerHTML).toBe('');
});

test('does not render raw HTML, images, or executable links', () => {
    const { container } = render(<LoginMessage message={'<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n![image](https://example.com/image.png)\n\n[unsafe](javascript:alert%281%29)'} />);
    expect(container.querySelector('script, img')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('unsafe')).toBeTruthy();
});

test.each([40, 120])('shows the full message without an expand button when its height is %i pixels', (height) => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(height);
    render(<LoginMessage message="Short instructions" />);
    expect(screen.queryByRole('button')).toBeNull();
});

test('allows long messages to be expanded and collapsed', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200);
    render(<LoginMessage message="Long instructions" />);
    const button = screen.getByRole('button', { name: 'Show more' });
    const content = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(content.style.maxHeight).toBe('120px');

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true');
    expect(content.style.maxHeight).toBe('');

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Show more' }).getAttribute('aria-expanded')).toBe('false');
    expect(content.style.maxHeight).toBe('120px');
});

test('updates the expand button when content height changes', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(40);
    let measure: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) {
            measure = callback;
        }
        observe() {}
        disconnect = disconnect;
    });
    const { unmount } = render(<LoginMessage message="Instructions that wrap on narrow screens" />);
    expect(screen.queryByRole('button')).toBeNull();

    height.mockReturnValue(200);
    act(() => measure());
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();

    height.mockReturnValue(40);
    act(() => measure());
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
});

test('collapses the preview again when the message changes', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200);
    const { rerender } = render(<LoginMessage message="Original instructions" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    rerender(<LoginMessage message="Updated instructions" />);
    expect(screen.getByRole('button', { name: 'Show more' }).getAttribute('aria-expanded')).toBe('false');
});

test('reveals the message when a link receives keyboard focus', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200);
    render(<LoginMessage message="[Request access](https://example.com/access)" />);
    fireEvent.focus(screen.getByRole('link', { name: 'Request access' }));
    expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true');
});
