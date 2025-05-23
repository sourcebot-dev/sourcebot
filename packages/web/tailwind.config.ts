import type { Config } from "tailwindcss"

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
				border: 'var(--border)',
				input: 'var(--input)',
				ring: 'var(--ring)',
				background: 'var(--background)',
				backgroundSecondary: 'var(--background-secondary)',
				foreground: 'var(--foreground)',
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)'
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)'
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)'
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)'
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)'
				},
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)'
				},
				highlight: 'var(--highlight)',
				sidebar: {
					DEFAULT: 'var(--sidebar-background)',
					foreground: 'var(--sidebar-foreground)',
					primary: 'var(--sidebar-primary)',
					'primary-foreground': 'var(--sidebar-primary-foreground)',
					accent: 'var(--sidebar-accent)',
					'accent-foreground': 'var(--sidebar-accent-foreground)',
					border: 'var(--sidebar-border)',
					ring: 'var(--sidebar-ring)'
				},
				editor: {
					background: 'var(--editor-background)',
					foreground: 'var(--editor-foreground)',
					caret: 'var(--editor-caret)',
					selection: 'var(--editor-selection)',
					selectionMatch: 'var(--editor-selection-match)',
					gutterBackground: 'var(--editor-gutter-background)',
					gutterForeground: 'var(--editor-gutter-foreground)',
					gutterBorder: 'var(--editor-gutter-border)',
					gutterActiveForeground: 'var(--editor-gutter-active-foreground)',
					lineHighlight: 'var(--editor-line-highlight)',

					tag: {
						comment: 'var(--editor-tag-comment)',
						keyword: 'var(--editor-tag-keyword)',
						'variable-definition': 'var(--editor-tag-variable-definition)',
						name: 'var(--editor-tag-name)',
						'property-definition': 'var(--editor-tag-property-definition)',
					}
				},
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
				'spin-slow': 'spin 1.5s linear infinite'
			}
		}
	},
	plugins: [
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		require("tailwindcss-animate"),
	],
} satisfies Config

export default config