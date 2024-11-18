import fetch from 'cross-fetch';
import { GerritConfig } from './schemas/v2.js';
import { AppContext, GitRepository } from './types.js';
import { createLogger } from './logger.js';
import path from 'path';
import { measure, marshalBool } from './utils.js';
import micromatch from "micromatch";

// TODO: Use gerrit API: https://github.com/gerritkit/client
// https://gerrit-review.googlesource.com/Documentation/rest-api.html
interface GerritProjects {
   [projectName: string]: GerritProjectInfo;
}

interface GerritProjectInfo {
   id: string;
   state?: string;
   web_links?: GerritWebLink[];
}

interface GerritWebLink {
   name: string;
   url: string;
}

interface GerritBranch {
   ref: string;
   revision: string;
   web_links?: GerritWebLink[];
}

// TODO: Implement tags
// interface GerritTagger {
//    name: string;
//    email: string;
//    date: string;
//    tz: number;
// }

// interface GerritTag {
//    ref: string;
//    revision: string;
//    object: string;
//    message: string;
//    tagger: GerritTagger;
// }

const logger = createLogger('Gerrit');

export const getGerritReposFromConfig = async (config: GerritConfig, ctx: AppContext) => {
   // Example URLs for experimentation:
   // https://chromium-review.googlesource.com
   // https://review.opendev.org
   // https://android-review.googlesource.com

   const url = config.url.endsWith('/') ? config.url : `${config.url}/`;

   const { durationMs, data: projects } = await measure(() =>
      fetchProjects(url, config)
   );

   logger.debug(`Fetched ${Object.keys(projects).length} projects in ${durationMs}ms.`);

   let projectNames = Object.keys(projects);

   // If specific repos are specified in config, filter the projects
   if (config.projects && config.projects.length > 0) {
      projectNames = projectNames.filter((name) => config.projects!.includes(name));
   }

   // If specific repos are excluded in config, filter the projects
   logger.debug(`Excluding repos: ${config.exclude?.projects}`);
   if (config.exclude && config.exclude.projects && config.exclude.projects.length > 0) {
      projectNames = projectNames.filter((name) => !config.exclude!.projects!.includes(name));
   }

   // Limit to specified number of repos
   if (config.limit && config.limit > 0) {
      projectNames = projectNames.slice(0, config.limit);
   }

   const hostname = new URL(config.url).hostname;

   let repos: GitRepository[] = projectNames.map((projectName) => {
      const repoId = `${hostname}/${projectName}`;
      const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`));

      const cloneUrl = `${url}${encodeURIComponent(projectName)}`;

      return {
         vcs: 'git',
         codeHost: 'gerrit',
         name: projectName,
         id: repoId,
         cloneUrl: cloneUrl,
         path: repoPath,
         isStale: false,
         isFork: false, // Gerrit doesn't have forks in the same sense
         isArchived: false, // Gerrit projects are typically not archived
         gitConfigMetadata: {
            'zoekt.web-url-type': 'gitiles',
            'zoekt.web-url': `${url}plugins/gitiles/${encodeURIComponent(projectName)}`,
            'zoekt.name': repoId,
            'zoekt.archived': marshalBool(false),
            'zoekt.fork': marshalBool(false),
            'zoekt.public': marshalBool(true), // Assuming projects are public; adjust as needed
         },
         branches: [],
         tags: []
      } satisfies GitRepository;
   });

   // Handle revisions if specified in config
   if (config.revisions && config.revisions.branches) {
      const branchGlobs = config.revisions.branches;
      repos = await Promise.all(repos.map(async (repo) => {
         logger.debug(`Fetching branches for repo ${repo.name}...`);
         let { durationMs, data } = await measure(() => fetchBranches(url, config, repo.name));
         logger.debug(`Found ${data.length} branches in repo ${repo.name} in ${durationMs}ms.`);

         const branches = data.map((branch) => branch.ref);
         logger.debug(`branches: ${branches}`);
         const matchedBranches = micromatch.match(branches, branchGlobs);
         logger.debug(`Matched ${matchedBranches.length} branches for repo ${repo.name}.`);
         return {
            ...repo,
            branches: matchedBranches,
         }

      }));
   }

   return repos;
};

const fetchProjects = async (url: string, config: GerritConfig): Promise<GerritProjects> => {

   const projectsEndpoint = `${url}projects/`;
   logger.debug(`Fetching projects from Gerrit at ${projectsEndpoint}...`);
   let response = null;
   response = await fetch(projectsEndpoint);

   if (!response.ok) {
      throw new Error(`Failed to fetch projects from Gerrit: ${response.statusText}`);
   }

   const text = await response.text();

   // Gerrit prepends ")]}'\n" to prevent XSSI attacks; remove it
   const jsonText = text.replace(")]}'\n", '');
   const data = JSON.parse(jsonText);
   return data;
};

const fetchBranches = async (url: string, config: GerritConfig, projectName: string): Promise<GerritBranch[]> => {

   const branchesEndpoint = `${url}projects/${encodeURIComponent(projectName)}/branches/`;
   logger.debug(`Fetching branches from Gerrit at ${branchesEndpoint}...`);
   let response = null;
   response = await fetch(branchesEndpoint);

   if (!response.ok) {
      throw new Error(`Failed to fetch branches from Gerrit: ${response.statusText}`);
   }

   const text = await response.text();

   // Gerrit prepends ")]}'\n" to prevent XSSI attacks; remove it
   const jsonText = text.replace(")]}'\n", '');
   const data = JSON.parse(jsonText);
   return data;
}

// TODO: Implement fetching tags from Gerrit
// const fetchTags = async (url: string, config: GerritConfig, projectName: string): Promise<GerritTag[]> => {
//    const tagsEndpoint = `${url}projects/${encodeURIComponent(projectName)}/tags/`;
// }

// TODO: Implement authentication for Gerrit
