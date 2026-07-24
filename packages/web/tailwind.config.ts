import type { Config } from "tailwindcss"

const withOpacity = (variable: `--${string}`) =>
    `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`

const config = {
    darkMode: ["class"],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px'
            }
        },
        extend: {
            colors: {
                border: withOpacity('--border'),
                input: withOpacity('--input'),
                ring: withOpacity('--ring'),
                background: withOpacity('--background'),
                backgroundSecondary: withOpacity('--background-secondary'),
                foreground: withOpacity('--foreground'),
                primary: {
                    DEFAULT: withOpacity('--primary'),
                    foreground: withOpacity('--primary-foreground')
                },
                secondary: {
                    DEFAULT: withOpacity('--secondary'),
                    foreground: withOpacity('--secondary-foreground')
                },
                destructive: {
                    DEFAULT: withOpacity('--destructive'),
                    foreground: withOpacity('--destructive-foreground')
                },
                muted: {
                    DEFAULT: withOpacity('--muted'),
                    foreground: withOpacity('--muted-foreground'),
                    accent: withOpacity('--muted-accent')
                },
                accent: {
                    DEFAULT: withOpacity('--accent'),
                    foreground: withOpacity('--accent-foreground')
                },
                popover: {
                    DEFAULT: withOpacity('--popover'),
                    foreground: withOpacity('--popover-foreground')
                },
                card: {
                    DEFAULT: withOpacity('--card'),
                    foreground: withOpacity('--card-foreground')
                },
                highlight: withOpacity('--highlight'),
                link: withOpacity('--link'),
                shell: withOpacity('--shell'),
                sidebar: {
                    DEFAULT: withOpacity('--sidebar-background'),
                    foreground: withOpacity('--sidebar-foreground'),
                    primary: withOpacity('--sidebar-primary'),
                    'primary-foreground': withOpacity('--sidebar-primary-foreground'),
                    accent: withOpacity('--sidebar-accent'),
                    'accent-foreground': withOpacity('--sidebar-accent-foreground'),
                    border: withOpacity('--sidebar-border'),
                    ring: withOpacity('--sidebar-ring')
                },
                warning: withOpacity('--warning'),
                error: withOpacity('--error'),
                editor: {
                    background: withOpacity('--editor-background'),
                    foreground: withOpacity('--editor-foreground'),
                    caret: withOpacity('--editor-caret'),
                    selection: withOpacity('--editor-selection'),
                    selectionMatch: withOpacity('--editor-selection-match'),
                    gutterBackground: withOpacity('--editor-gutter-background'),
                    gutterForeground: withOpacity('--editor-gutter-foreground'),
                    gutterBorder: 'var(--editor-gutter-border)',
                    gutterActiveForeground: withOpacity('--editor-gutter-active-foreground'),
                    lineHighlight: withOpacity('--editor-line-highlight'),
                    tag: {
                        keyword: withOpacity('--editor-tag-keyword'),
                        name: withOpacity('--editor-tag-name'),
                        function: withOpacity('--editor-tag-function'),
                        label: withOpacity('--editor-tag-label'),
                        constant: withOpacity('--editor-tag-constant'),
                        definition: withOpacity('--editor-tag-definition'),
                        brace: withOpacity('--editor-tag-brace'),
                        type: withOpacity('--editor-tag-type'),
                        operator: withOpacity('--editor-tag-operator'),
                        tag: withOpacity('--editor-tag-tag'),
                        'bracket-square': withOpacity('--editor-tag-bracket-square'),
                        'bracket-angle': withOpacity('--editor-tag-bracket-angle'),
                        attribute: withOpacity('--editor-tag-attribute'),
                        string: withOpacity('--editor-tag-string'),
                        link: 'var(--editor-tag-link)',
                        meta: withOpacity('--editor-tag-meta'),
                        comment: withOpacity('--editor-tag-comment'),
                        emphasis: 'var(--editor-tag-emphasis)',
                        heading: 'var(--editor-tag-heading)',
                        atom: withOpacity('--editor-tag-atom'),
                        processing: withOpacity('--editor-tag-processing'),
                        separator: withOpacity('--editor-tag-separator'),
                        invalid: withOpacity('--editor-tag-invalid'),
                        quote: withOpacity('--editor-tag-quote'),
                        'annotation-special': withOpacity('--editor-tag-annotation-special'),
                        number: withOpacity('--editor-tag-number'),
                        regexp: withOpacity('--editor-tag-regexp'),
                        'variable-local': withOpacity('--editor-tag-variable-local')
                    }
                },
                chat: {
                    reference: withOpacity('--chat-reference'),
                    'reference-hover': withOpacity('--chat-reference-hover'),
                    'reference-selected': withOpacity('--chat-reference-selected'),
                    'reference-selected-border': withOpacity('--chat-reference-selected-border')
                }
            },
            fontSize: {
                editor: 'var(--editor-font-size)'
            },
            fontFamily: {
                editor: 'var(--editor-font-family)'
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            keyframes: {
                'accordion-down': {
                    from: {
                        height: '0'
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)'
                    }
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)'
                    },
                    to: {
                        height: '0'
                    }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'spin-slow': 'spin 1.5s linear infinite',
                'bounce-slow': 'bounce 1.5s linear infinite',
                'ping-slow': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
            }
        }
    },
    plugins: [
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("tailwindcss-animate"),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@tailwindcss/typography'),
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@tailwindcss/container-queries'),
    ],
} satisfies Config

export default config
