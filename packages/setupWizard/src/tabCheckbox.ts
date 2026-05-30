// Fork of @inquirer/checkbox that uses Tab (instead of Space) to toggle selection.
// Kept in sync with @inquirer/checkbox 4.x — only the keybinding and help text differ.

import {
    createPrompt,
    isDownKey,
    isEnterKey,
    isNumberKey,
    isTabKey,
    isUpKey,
    makeTheme,
    Separator,
    useKeypress,
    useMemo,
    usePagination,
    usePrefix,
    useState,
    ValidationError,
    type Theme,
    type Keybinding,
} from '@inquirer/core';
import type { PartialDeep } from '@inquirer/type';
import { cursorHide } from '@inquirer/ansi';
import { styleText } from 'node:util';
import figures from '@inquirer/figures';

type CheckboxTheme = {
    icon: {
        checked: string;
        unchecked: string;
        cursor: string;
        disabledChecked: string;
        disabledUnchecked: string;
    };
    style: {
        disabled: (text: string) => string;
        renderSelectedChoices: <T>(
            selectedChoices: ReadonlyArray<NormalizedChoice<T>>,
            allChoices: ReadonlyArray<NormalizedChoice<T> | Separator>,
        ) => string;
        description: (text: string) => string;
        keysHelpTip: (keys: [key: string, action: string][]) => string | undefined;
    };
    i18n: { disabledError: string };
    keybindings: ReadonlyArray<Keybinding>;
};

type CheckboxShortcuts = {
    all?: string | null;
    invert?: string | null;
};

type Choice<Value> = {
    value: Value;
    name?: string;
    checkedName?: string;
    description?: string;
    short?: string;
    disabled?: boolean | string;
    checked?: boolean;
    type?: never;
};

type NormalizedChoice<Value> = {
    value: Value;
    name: string;
    checkedName: string;
    description?: string;
    short: string;
    disabled: boolean | string;
    checked: boolean;
};

const checkboxTheme: CheckboxTheme = {
    icon: {
        checked: styleText('green', figures.circleFilled),
        unchecked: figures.circle,
        cursor: figures.pointer,
        disabledChecked: styleText('green', figures.circleDouble),
        disabledUnchecked: '-',
    },
    style: {
        disabled: (text: string) => styleText('dim', text),
        renderSelectedChoices: (selectedChoices) =>
            selectedChoices.map((choice) => choice.short).join(', '),
        description: (text: string) => styleText('cyan', text),
        keysHelpTip: (keys) =>
            keys
                .map(([key, action]) => `${styleText('bold', key)} ${styleText('dim', action)}`)
                .join(styleText('dim', ' • ')),
    },
    i18n: { disabledError: 'This option is disabled and cannot be toggled.' },
    keybindings: [],
};

function isSelectable<Value>(item: NormalizedChoice<Value> | Separator): item is NormalizedChoice<Value> {
    return !Separator.isSeparator(item) && !item.disabled;
}

function isNavigable<Value>(item: NormalizedChoice<Value> | Separator): item is NormalizedChoice<Value> {
    return !Separator.isSeparator(item);
}

function isChecked<Value>(item: NormalizedChoice<Value> | Separator): item is NormalizedChoice<Value> {
    return !Separator.isSeparator(item) && item.checked;
}

function toggle<Value>(item: NormalizedChoice<Value> | Separator): NormalizedChoice<Value> | Separator {
    return isSelectable(item) ? { ...item, checked: !item.checked } : item;
}

function check(checked: boolean) {
    return function <Value>(item: NormalizedChoice<Value> | Separator): NormalizedChoice<Value> | Separator {
        return isSelectable(item) ? { ...item, checked } : item;
    };
}

function normalizeChoices<Value>(
    choices: readonly (Separator | Value | Choice<Value>)[],
): (NormalizedChoice<Value> | Separator)[] {
    return choices.map((choice) => {
        if (Separator.isSeparator(choice)) {
            return choice;
        }
        if (typeof choice !== 'object' || choice === null || !('value' in (choice as object))) {
            const name = String(choice);
            return {
                value: choice as Value,
                name,
                short: name,
                checkedName: name,
                disabled: false,
                checked: false,
            };
        }
        const c = choice as Choice<Value>;
        const name = c.name ?? String(c.value);
        const normalizedChoice: NormalizedChoice<Value> = {
            value: c.value,
            name,
            short: c.short ?? name,
            checkedName: c.checkedName ?? name,
            disabled: c.disabled ?? false,
            checked: c.checked ?? false,
        };
        if (c.description) {
            normalizedChoice.description = c.description;
        }
        return normalizedChoice;
    });
}

type TabCheckboxConfig<Value> = {
    message: string;
    prefix?: string;
    pageSize?: number;
    choices: readonly (Separator | Value | Choice<Value>)[];
    loop?: boolean;
    required?: boolean;
    validate?: (
        choices: readonly NormalizedChoice<Value>[],
    ) => boolean | string | Promise<string | boolean>;
    theme?: PartialDeep<Theme<CheckboxTheme>>;
    shortcuts?: CheckboxShortcuts;
};

export const tabCheckbox = createPrompt(
    <Value,>(config: TabCheckboxConfig<Value>, done: (value: Value[]) => void) => {
        const { pageSize = 7, loop = true, required, validate = () => true } = config;
        const shortcuts = { all: 'a', invert: 'i', ...config.shortcuts };
        const theme = makeTheme<CheckboxTheme>(checkboxTheme, config.theme);
        const { keybindings } = theme;
        const [status, setStatus] = useState<'idle' | 'done'>('idle');
        const prefix = usePrefix({ status, theme });
        const [items, setItems] = useState<(NormalizedChoice<Value> | Separator)[]>(
            normalizeChoices(config.choices),
        );
        const bounds = useMemo(() => {
            const first = items.findIndex(isNavigable);
            const last = items.findLastIndex(isNavigable);
            if (first === -1) {
                throw new ValidationError('[checkbox prompt] No selectable choices. All choices are disabled.');
            }
            return { first, last };
        }, [items]);
        const [active, setActive] = useState(bounds.first);
        const [errorMsg, setError] = useState<string | undefined>();

        useKeypress(async (key) => {
            if (isEnterKey(key)) {
                const selection = items.filter(isChecked);
                const isValid = await validate([...selection]);
                if (required && !selection.length) {
                    setError('At least one choice must be selected');
                } else if (isValid === true) {
                    setStatus('done');
                    done(selection.map((choice) => choice.value));
                } else {
                    setError(isValid || 'You must select a valid value');
                }
            } else if (isUpKey(key, keybindings) || isDownKey(key, keybindings)) {
                if (errorMsg) {
                    setError(undefined);
                }
                if (
                    loop ||
                    (isUpKey(key, keybindings) && active !== bounds.first) ||
                    (isDownKey(key, keybindings) && active !== bounds.last)
                ) {
                    const offset = isUpKey(key, keybindings) ? -1 : 1;
                    let next = active;
                    do {
                        next = (next + offset + items.length) % items.length;
                    } while (!isNavigable(items[next]!));
                    setActive(next);
                }
            } else if (isTabKey(key)) {
                const activeItem = items[active];
                if (activeItem && !Separator.isSeparator(activeItem)) {
                    if (activeItem.disabled) {
                        setError(theme.i18n.disabledError);
                    } else {
                        setError(undefined);
                        setItems(items.map((choice, i) => (i === active ? toggle(choice) : choice)));
                    }
                }
            } else if (key.name === shortcuts.all) {
                const selectAll = items.some((choice) => isSelectable(choice) && !choice.checked);
                setItems(items.map(check(selectAll)));
            } else if (key.name === shortcuts.invert) {
                setItems(items.map(toggle));
            } else if (isNumberKey(key)) {
                const selectedIndex = Number(key.name) - 1;
                let selectableIndex = -1;
                const position = items.findIndex((item) => {
                    if (Separator.isSeparator(item)) {
                        return false;
                    }
                    selectableIndex++;
                    return selectableIndex === selectedIndex;
                });
                const selectedItem = items[position];
                if (selectedItem && isSelectable(selectedItem)) {
                    setActive(position);
                    setItems(items.map((choice, i) => (i === position ? toggle(choice) : choice)));
                }
            }
        });

        const message = theme.style.message(config.message, status);
        let description: string | undefined;
        const page = usePagination({
            items,
            active,
            renderItem({ item, isActive }) {
                if (Separator.isSeparator(item)) {
                    return ` ${item.separator}`;
                }
                const cursor = isActive ? theme.icon.cursor : ' ';
                if (item.disabled) {
                    const disabledLabel = typeof item.disabled === 'string' ? item.disabled : '(disabled)';
                    const checkbox = item.checked ? theme.icon.disabledChecked : theme.icon.disabledUnchecked;
                    return theme.style.disabled(`${cursor}${checkbox} ${item.name} ${disabledLabel}`);
                }
                if (isActive) {
                    description = item.description;
                }
                const checkbox = item.checked ? theme.icon.checked : theme.icon.unchecked;
                const name = item.checked ? item.checkedName : item.name;
                const color = isActive ? theme.style.highlight : (x: string) => x;
                return color(`${cursor}${checkbox} ${name}`);
            },
            pageSize,
            loop,
        });

        if (status === 'done') {
            const selection = items.filter(isChecked);
            const answer = theme.style.answer(theme.style.renderSelectedChoices(selection, items));
            return [prefix, message, answer].filter(Boolean).join(' ');
        }

        const keys: [string, string][] = [
            ['↑↓', 'navigate'],
            ['tab', 'select'],
        ];
        if (shortcuts.all) {
            keys.push([shortcuts.all, 'all']);
        }
        if (shortcuts.invert) {
            keys.push([shortcuts.invert, 'invert']);
        }
        keys.push(['⏎', 'submit']);
        const helpLine = theme.style.keysHelpTip(keys);
        const lines = [
            [prefix, message].filter(Boolean).join(' '),
            page,
            ' ',
            description ? theme.style.description(description) : '',
            errorMsg ? theme.style.error(errorMsg) : '',
            helpLine,
        ]
            .filter(Boolean)
            .join('\n')
            .trimEnd();
        return `${lines}${cursorHide}`;
    },
);
