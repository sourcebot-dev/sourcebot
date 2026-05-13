import requireAuthWrapper from './rules/requireAuthWrapper.mjs';

const plugin = {
    meta: {
        name: 'eslint-plugin-authz-local',
    },
    rules: {
        'require-auth-wrapper': requireAuthWrapper,
    },
};

export default plugin;
