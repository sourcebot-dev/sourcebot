import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { shouldExcludeProject, GerritProject, getGerritReposFromConfig } from './gerrit';
import { GerritConnectionConfig } from '@sourcebot/schemas/v3/index.type';
import { PrismaClient } from '@sourcebot/db';
import { BackendException, BackendError } from '@sourcebot/error';
import fetch from 'cross-fetch';

// Mock dependencies
vi.mock('cross-fetch');
vi.mock('./logger.js', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    })
}));
vi.mock('./utils.js', async () => {
    const actual = await vi.importActual('./utils.js');
    return {
        ...actual,
        measure: vi.fn(async (fn) => {
            const result = await fn();
            return { data: result, durationMs: 100 };
        }),
        fetchWithRetry: vi.fn(async (fn) => {
            const result = await fn();
            return result;
        }),
        getTokenFromConfig: vi.fn().mockImplementation(async (token) => {
            // String tokens are no longer supported (security measure)
            if (typeof token === 'string') {
                throw new Error('Invalid token configuration');
            }
            // For objects (env/secret), return mock value
            if (token && typeof token === 'object' && ('secret' in token || 'env' in token)) {
                return 'mock-password';
            }
            throw new Error('Invalid token configuration');
        }),
    };
});
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

const mockFetch = vi.mocked(fetch);
const mockDb = {} as PrismaClient;

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

test('shouldExcludeProject returns false when the project is not excluded', () => {
    const project: GerritProject = {
        name: 'test/project',
        id: 'test%2Fproject',
        state: 'ACTIVE'
    };

    expect(shouldExcludeProject({
        project,
    })).toBe(false);
});

test('shouldExcludeProject returns true for special Gerrit projects', () => {
    const specialProjects = [
        'All-Projects',
        'All-Users',
        'All-Avatars',
        'All-Archived-Projects'
    ];

    specialProjects.forEach(projectName => {
        const project: GerritProject = {
            name: projectName,
            id: projectName.replace(/-/g, '%2D'),
            state: 'ACTIVE'
        };

        expect(shouldExcludeProject({ project })).toBe(true);
    });
});

test('shouldExcludeProject handles readOnly projects correctly', () => {
    const project: GerritProject = {
        name: 'test/readonly-project',
        id: 'test%2Freadonly-project',
        state: 'READ_ONLY'
    };

    expect(shouldExcludeProject({ project })).toBe(false);
    expect(shouldExcludeProject({ 
        project, 
        exclude: { readOnly: true } 
    })).toBe(true);
    expect(shouldExcludeProject({ 
        project, 
        exclude: { readOnly: false } 
    })).toBe(false);
});

test('shouldExcludeProject handles hidden projects correctly', () => {
    const project: GerritProject = {
        name: 'test/hidden-project',
        id: 'test%2Fhidden-project',
        state: 'HIDDEN'
    };

    expect(shouldExcludeProject({ project })).toBe(false);
    expect(shouldExcludeProject({ 
        project, 
        exclude: { hidden: true } 
    })).toBe(true);
    expect(shouldExcludeProject({ 
        project, 
        exclude: { hidden: false } 
    })).toBe(false);
});

test('shouldExcludeProject handles exclude.projects correctly', () => {
    const project: GerritProject = {
        name: 'test/example-project',
        id: 'test%2Fexample-project',
        state: 'ACTIVE'
    };

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: []
        }
    })).toBe(false);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['test/example-project']
        }
    })).toBe(true);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['test/*']
        }
    })).toBe(true);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['other/project']
        }
    })).toBe(false);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['test/different-*']
        }
    })).toBe(false);
});

test('shouldExcludeProject handles complex glob patterns correctly', () => {
    const project: GerritProject = {
        name: 'android/platform/build',
        id: 'android%2Fplatform%2Fbuild',
        state: 'ACTIVE'
    };

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['android/**']
        }
    })).toBe(true);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['android/platform/*']
        }
    })).toBe(true);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['android/*/build']
        }
    })).toBe(true);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['ios/**']
        }
    })).toBe(false);
});

test('shouldExcludeProject handles multiple exclusion criteria', () => {
    const readOnlyProject: GerritProject = {
        name: 'archived/old-project',
        id: 'archived%2Fold-project',
        state: 'READ_ONLY'
    };

    expect(shouldExcludeProject({
        project: readOnlyProject,
        exclude: {
            readOnly: true,
            projects: ['archived/*']
        }
    })).toBe(true);

    const hiddenProject: GerritProject = {
        name: 'secret/internal-project',
        id: 'secret%2Finternal-project',
        state: 'HIDDEN'
    };

    expect(shouldExcludeProject({
        project: hiddenProject,
        exclude: {
            hidden: true,
            projects: ['public/*']
        }
    })).toBe(true);
});

test('shouldExcludeProject handles edge cases', () => {
    // Test with minimal project data
    const minimalProject: GerritProject = {
        name: 'minimal',
        id: 'minimal'
    };

    expect(shouldExcludeProject({ project: minimalProject })).toBe(false);

    // Test with empty exclude object
    expect(shouldExcludeProject({
        project: minimalProject,
        exclude: {}
    })).toBe(false);

    // Test with undefined exclude
    expect(shouldExcludeProject({
        project: minimalProject,
        exclude: undefined
    })).toBe(false);
});

test('shouldExcludeProject handles case sensitivity in project names', () => {
    const project: GerritProject = {
        name: 'Test/Example-Project',
        id: 'Test%2FExample-Project',
        state: 'ACTIVE'
    };

    // micromatch should handle case sensitivity based on its default behavior
    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['test/example-project']
        }
    })).toBe(false);

    expect(shouldExcludeProject({
        project,
        exclude: {
            projects: ['Test/Example-Project']
        }
    })).toBe(true);
});

test('shouldExcludeProject handles project with web_links', () => {
    const projectWithLinks: GerritProject = {
        name: 'test/project-with-links',
        id: 'test%2Fproject-with-links',
        state: 'ACTIVE',
        web_links: [
            {
                name: 'browse',
                url: 'https://gerrit.example.com/plugins/gitiles/test/project-with-links'
            }
        ]
    };

    expect(shouldExcludeProject({ project: projectWithLinks })).toBe(false);
    
    expect(shouldExcludeProject({
        project: projectWithLinks,
        exclude: {
            projects: ['test/*']
        }
    })).toBe(true);
});

// === HTTP Authentication Tests ===

test('getGerritReposFromConfig handles public access without authentication', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project']
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject", "state": "ACTIVE"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
        name: 'test-project',
        id: 'test%2Dproject',
        state: 'ACTIVE'
    });

    // Verify that public endpoint was called (no /a/ prefix)
    expect(mockFetch).toHaveBeenCalledWith(
        'https://gerrit.example.com/projects/?S=0',
        expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
                'Accept': 'application/json',
                'User-Agent': 'Sourcebot-Gerrit-Client/1.0'
            })
        })
    );

    // Verify no Authorization header for public access
    const [, options] = mockFetch.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Authorization');
});

test('getGerritReposFromConfig handles authenticated access with HTTP Basic Auth', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: 'test-password'
        }
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject", "state": "ACTIVE"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
        name: 'test-project',
        id: 'test%2Dproject',
        state: 'ACTIVE'
    });

    // Verify that authenticated endpoint was called (with /a/ prefix)
    expect(mockFetch).toHaveBeenCalledWith(
        'https://gerrit.example.com/a/projects/?S=0',
        expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
                'Accept': 'application/json',
                'User-Agent': 'Sourcebot-Gerrit-Client/1.0',
                'Authorization': expect.stringMatching(/^Basic /)
            })
        })
    );

    // Verify that Authorization header is present and properly formatted
    const [, options] = mockFetch.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    const authHeader = headers?.Authorization;
    
    // Verify Basic Auth format exists
    expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
    
    // Verify it contains the username (password will be mocked)
    const encodedCredentials = authHeader?.replace('Basic ', '');
    const decodedCredentials = Buffer.from(encodedCredentials || '', 'base64').toString();
    expect(decodedCredentials).toContain('testuser:');
});

test('getGerritReposFromConfig handles environment variable password', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: { env: 'GERRIT_HTTP_PASSWORD' }
        }
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject", "state": "ACTIVE"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    
    // Verify that getTokenFromConfig was called for environment variable
    const { getTokenFromConfig } = await import('./utils.js');
    expect(getTokenFromConfig).toHaveBeenCalledWith(
        { env: 'GERRIT_HTTP_PASSWORD' },
        1,
        mockDb,
        expect.any(Object)
    );
});

test('getGerritReposFromConfig handles secret-based password', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: { secret: 'GERRIT_SECRET' }
        }
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject", "state": "ACTIVE"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    
    // Verify that getTokenFromConfig was called for secret
    const { getTokenFromConfig } = await import('./utils.js');
    expect(getTokenFromConfig).toHaveBeenCalledWith(
        { secret: 'GERRIT_SECRET' },
        1,
        mockDb,
        expect.any(Object)
    );
});

test('getGerritReposFromConfig handles authentication errors', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: 'invalid-password'
        }
    };

    const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    await expect(getGerritReposFromConfig(config, 1, mockDb)).rejects.toThrow(BackendException);
});

test('getGerritReposFromConfig handles network errors', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project']
    };

    const networkError = new Error('Network error');
    (networkError as any).code = 'ECONNREFUSED';
    mockFetch.mockRejectedValueOnce(networkError);

    await expect(getGerritReposFromConfig(config, 1, mockDb)).rejects.toThrow(BackendException);
});

test('getGerritReposFromConfig handles malformed JSON response', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project']
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve('invalid json'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    await expect(getGerritReposFromConfig(config, 1, mockDb)).rejects.toThrow();
});

test('getGerritReposFromConfig strips XSSI protection prefix correctly', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project']
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject", "state": "ACTIVE"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
        name: 'test-project',
        id: 'test%2Dproject',
        state: 'ACTIVE'
    });
});

test('getGerritReposFromConfig handles pagination correctly', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com'
    };

    // First page response
    const firstPageResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"project1": {"id": "project1", "_more_projects": true}}'),
    };
    
    // Second page response
    const secondPageResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"project2": {"id": "project2"}}'),
    };

    mockFetch
        .mockResolvedValueOnce(firstPageResponse as any)
        .mockResolvedValueOnce(secondPageResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('project1');
    expect(result[1].name).toBe('project2');

    // Verify pagination calls
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, 
        'https://gerrit.example.com/projects/?S=0',
        expect.any(Object)
    );
    expect(mockFetch).toHaveBeenNthCalledWith(2, 
        'https://gerrit.example.com/projects/?S=1',
        expect.any(Object)
    );
});

test('getGerritReposFromConfig filters projects based on config.projects', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-*'] // Only projects matching this pattern
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject"}, "other-project": {"id": "other%2Dproject"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test-project');
});

test('getGerritReposFromConfig excludes projects based on config.exclude', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        exclude: {
            readOnly: true,
            hidden: true,
            projects: ['excluded-*']
        }
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{' +
            '"active-project": {"id": "active%2Dproject", "state": "ACTIVE"}, ' +
            '"readonly-project": {"id": "readonly%2Dproject", "state": "READ_ONLY"}, ' +
            '"hidden-project": {"id": "hidden%2Dproject", "state": "HIDDEN"}, ' +
            '"excluded-project": {"id": "excluded%2Dproject", "state": "ACTIVE"}' +
        '}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('active-project');
});

test('getGerritReposFromConfig handles trailing slash in URL correctly', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com/', // Note trailing slash
        projects: ['test-project']
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    await getGerritReposFromConfig(config, 1, mockDb);

    // Verify URL is normalized correctly
    expect(mockFetch).toHaveBeenCalledWith(
        'https://gerrit.example.com/projects/?S=0',
        expect.any(Object)
    );
});

test('getGerritReposFromConfig handles projects with web_links', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project']
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{' +
            '"test-project": {' +
                '"id": "test%2Dproject", ' +
                '"state": "ACTIVE", ' +
                '"web_links": [{"name": "browse", "url": "https://gerrit.example.com/plugins/gitiles/test-project"}]' +
            '}' +
        '}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
        name: 'test-project',
        id: 'test%2Dproject',
        state: 'ACTIVE',
        web_links: [
            {
                name: 'browse',
                url: 'https://gerrit.example.com/plugins/gitiles/test-project'
            }
        ]
    });
});

test('getGerritReposFromConfig handles authentication credential retrieval errors', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: { env: 'MISSING_ENV_VAR' }
        }
    };

    // Mock getTokenFromConfig to throw an error
    const { getTokenFromConfig } = await import('./utils.js');
    vi.mocked(getTokenFromConfig).mockRejectedValueOnce(new Error('Environment variable not found'));

    await expect(getGerritReposFromConfig(config, 1, mockDb)).rejects.toThrow('Environment variable not found');
});

test('getGerritReposFromConfig handles empty projects response', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com'
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(0);
});

test('getGerritReposFromConfig handles response without XSSI prefix', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project']
    };

    // Response without XSSI prefix (some Gerrit instances might not include it)
    const mockResponse = {
        ok: true,
        text: () => Promise.resolve('{"test-project": {"id": "test%2Dproject", "state": "ACTIVE"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
        name: 'test-project',
        id: 'test%2Dproject',
        state: 'ACTIVE'
    });
});

test('getGerritReposFromConfig validates Basic Auth header format', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'user@example.com',
            password: 'complex-password-123!'
        }
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    await getGerritReposFromConfig(config, 1, mockDb);

    const [, options] = mockFetch.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    const authHeader = headers?.Authorization;
    
    // Verify Basic Auth format
    expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
    
    // Verify credentials can be decoded and contain the username
    const encodedCredentials = authHeader?.replace('Basic ', '');
    const decodedCredentials = Buffer.from(encodedCredentials || '', 'base64').toString();
    expect(decodedCredentials).toContain('user@example.com:');
});

test('getGerritReposFromConfig handles special characters in project names', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com'
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{' +
            '"project/with-dashes": {"id": "project%2Fwith-dashes"}, ' +
            '"project_with_underscores": {"id": "project_with_underscores"}, ' +
            '"project.with.dots": {"id": "project.with.dots"}, ' +
            '"project with spaces": {"id": "project%20with%20spaces"}' +
        '}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(4);
    expect(result.map(p => p.name)).toEqual([
        'project/with-dashes',
        'project_with_underscores',
        'project.with.dots',
        'project with spaces'
    ]);
});

test('getGerritReposFromConfig handles large project responses', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com'
    };

    // Generate a large response with many projects
    const projects: Record<string, any> = {};
    for (let i = 0; i < 100; i++) {
        projects[`project-${i}`] = {
            id: `project%2D${i}`,
            state: 'ACTIVE'
        };
    }

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n' + JSON.stringify(projects)),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    const result = await getGerritReposFromConfig(config, 1, mockDb);

    expect(result).toHaveLength(100);
    expect(result[0].name).toBe('project-0');
    expect(result[99].name).toBe('project-99');
});

test('getGerritReposFromConfig handles mixed authentication scenarios', async () => {
    // Test that the function correctly chooses authenticated vs public endpoints
    const publicConfig: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['public-project']
    };

    const authenticatedConfig: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['private-project'],
        auth: {
            username: 'testuser',
            password: 'test-password'
        }
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject"}}'),
    };

    // Test public access
    mockFetch.mockResolvedValueOnce(mockResponse as any);
    await getGerritReposFromConfig(publicConfig, 1, mockDb);
    
    expect(mockFetch).toHaveBeenLastCalledWith(
        'https://gerrit.example.com/projects/?S=0',
        expect.objectContaining({
            headers: expect.not.objectContaining({
                Authorization: expect.any(String)
            })
        })
    );

    // Test authenticated access
    mockFetch.mockResolvedValueOnce(mockResponse as any);
    await getGerritReposFromConfig(authenticatedConfig, 1, mockDb);
    
    expect(mockFetch).toHaveBeenLastCalledWith(
        'https://gerrit.example.com/a/projects/?S=0',
        expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: expect.stringMatching(/^Basic /)
            })
        })
    );
});

test('getGerritReposFromConfig handles passwords with special characters', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'user@example.com',
            password: { env: 'GERRIT_SPECIAL_PASSWORD' }
        }
    };

    // Mock getTokenFromConfig to return password with special characters
    const { getTokenFromConfig } = await import('./utils.js');
    vi.mocked(getTokenFromConfig).mockResolvedValueOnce('pass/with+special=chars');

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject"}}'),
    };
    mockFetch.mockResolvedValueOnce(mockResponse as any);

    await getGerritReposFromConfig(config, 1, mockDb);

    const [, options] = mockFetch.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    const authHeader = headers?.Authorization;
    
    // Verify Basic Auth format
    expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
    
    // Verify credentials can be decoded and contain the special characters
    const encodedCredentials = authHeader?.replace('Basic ', '');
    const decodedCredentials = Buffer.from(encodedCredentials || '', 'base64').toString();
    expect(decodedCredentials).toContain('user@example.com:pass/with+special=chars');
    
    // Verify that getTokenFromConfig was called for the password with special characters
    expect(getTokenFromConfig).toHaveBeenCalledWith(
        { env: 'GERRIT_SPECIAL_PASSWORD' },
        1,
        mockDb,
        expect.any(Object)
    );
});

test('getGerritReposFromConfig handles concurrent authentication requests', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: { env: 'GERRIT_HTTP_PASSWORD' }
        }
    };

    const mockResponse = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject"}}'),
    };

    // Mock multiple concurrent calls
    mockFetch.mockResolvedValue(mockResponse as any);

    const promises = Array(5).fill(null).map(() => 
        getGerritReposFromConfig(config, 1, mockDb)
    );

    const results = await Promise.all(promises);

    // All should succeed
    expect(results).toHaveLength(5);
    results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('test-project');
    });

    // Verify getTokenFromConfig was called for each request
    const { getTokenFromConfig } = await import('./utils.js');
    expect(getTokenFromConfig).toHaveBeenCalledTimes(5);
});

test('getGerritReposFromConfig rejects invalid token formats (security)', async () => {
    const configWithStringToken: any = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: 'direct-string-password' // This should be rejected
        }
    };

    await expect(getGerritReposFromConfig(configWithStringToken, 1, mockDb))
        .rejects.toThrow('CONNECTION_SYNC_FAILED_TO_FETCH_GERRIT_PROJECTS');

    const configWithMalformedToken: any = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project'],
        auth: {
            username: 'testuser',
            password: { invalid: 'format' } // This should be rejected
        }
    };

    await expect(getGerritReposFromConfig(configWithMalformedToken, 1, mockDb))
        .rejects.toThrow('CONNECTION_SYNC_FAILED_TO_FETCH_GERRIT_PROJECTS');
});

test('getGerritReposFromConfig handles responses with and without XSSI prefix', async () => {
    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url: 'https://gerrit.example.com',
        projects: ['test-project']
    };

    // Test with XSSI prefix
    const responseWithXSSI = {
        ok: true,
        text: () => Promise.resolve(')]}\'\n{"test-project": {"id": "test%2Dproject"}}'),
    };
    mockFetch.mockResolvedValueOnce(responseWithXSSI as any);

    const result1 = await getGerritReposFromConfig(config, 1, mockDb);
    expect(result1).toHaveLength(1);
    expect(result1[0].name).toBe('test-project');

    // Test without XSSI prefix
    const responseWithoutXSSI = {
        ok: true,
        text: () => Promise.resolve('{"test-project": {"id": "test%2Dproject"}}'),
    };
    mockFetch.mockResolvedValueOnce(responseWithoutXSSI as any);

    const result2 = await getGerritReposFromConfig(config, 1, mockDb);
    expect(result2).toHaveLength(1);
    expect(result2[0].name).toBe('test-project');
}); 