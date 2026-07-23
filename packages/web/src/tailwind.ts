import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../tailwind.config';

// Tailwind substitutes this placeholder only while generating utilities.
// Runtime consumers need a concrete opaque value instead.
const resolveRuntimeAlphaValues = <T>(value: T): T => {
    if (typeof value === 'string') {
        return value
            .replaceAll('calc(<alpha-value> * 100%)', '100%')
            .replaceAll('<alpha-value>', '1') as T;
    }

    if (Array.isArray(value)) {
        return value.map(resolveRuntimeAlphaValues) as T;
    }

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [
                key,
                resolveRuntimeAlphaValues(child),
            ]),
        ) as T;
    }

    return value;
};

const resolvedConfig = resolveConfig(tailwindConfig);
const tailwind = {
    ...resolvedConfig,
    theme: {
        ...resolvedConfig.theme,
        colors: resolveRuntimeAlphaValues(resolvedConfig.theme.colors),
    },
};

export default tailwind;
