import fetch from 'cross-fetch';
import { GerritConfig } from "@sourcebot/schemas/v2/index.type"
import { AppContext, GitRepository } from './types.js';
import { createLogger } from './logger.js';
import path from 'path';
import { measure, marshalBool, excludeReposByName, includeReposByName } from './utils.js';

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

const logger = createLogger('Gerrit');

export const getGerritReposFromConfig = async (config: GerritConfig, ctx: AppContext): Promise<GitRepository[]> => {

   const url = config.url.endsWith('/') ? config.url : `${config.url}/`;
   const hostname = new URL(config.url).hostname;

   const { durationMs, data: projects } = await measure(async () => {
      try {
         return fetchAllProjects(url)
      } catch (err) {
         logger.error(`Failed to fetch projects from ${url}`, err);
         return null;
      }
   });

   if (!projects) {
      return [];
   }

   // exclude "All-Projects" and "All-Users" projects
   delete projects['All-Projects'];
   delete projects['All-Users'];
   delete projects['All-Avatars']
   delete projects['All-Archived-Projects']

   logger.debug(`Fetched ${Object.keys(projects).length} projects in ${durationMs}ms.`);

   let repos: GitRepository[] = Object.keys(projects).map((projectName) => {
      const project = projects[projectName];
      let webUrl = "https://www.gerritcodereview.com/";
      // Gerrit projects can have multiple web links; use the first one
      if (project.web_links) {
         const webLink = project.web_links[0];
         if (webLink) {
            webUrl = webLink.url;
         }
      }
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
         isStale: false, // Gerrit projects are typically not stale
         isFork: false, // Gerrit doesn't have forks in the same way as GitHub
         isArchived: false,
         gitConfigMetadata: {
            // Gerrit uses Gitiles for web UI. This can sometimes be "browse" type in zoekt
            'zoekt.web-url-type': 'gitiles',
            'zoekt.web-url': webUrl,
            'zoekt.name': repoId,
            'zoekt.archived': marshalBool(false),
            'zoekt.fork': marshalBool(false),
            'zoekt.public': marshalBool(true), // Assuming projects are public; adjust as needed
         },
         branches: [],
         tags: []
      } satisfies GitRepository;
   });

   // include repos by glob if specified in config
   if (config.projects) {
      repos = includeReposByName(repos, config.projects);
   }

   if (config.exclude && config.exclude.projects) {
      repos = excludeReposByName(repos, config.exclude.projects);
   }

   return repos;
};

const fetchAllProjects = async (url: string): Promise<GerritProjects> => {
   const projectsEndpoint = `${url}projects/`;
   let allProjects: GerritProjects = {};
   let start = 0; // Start offset for pagination
   let hasMoreProjects = true;

   while (hasMoreProjects) {
      const endpointWithParams = `${projectsEndpoint}?S=${start}`;
      logger.debug(`Fetching projects from Gerrit at ${endpointWithParams}`);

      const response = await fetch(endpointWithParams);
      if (!response.ok) {
         throw new Error(`Failed to fetch projects from Gerrit: ${response.statusText}`);
      }

      const text = await response.text();
      const jsonText = text.replace(")]}'\n", ''); // Remove XSSI protection prefix
      const data: GerritProjects = JSON.parse(jsonText);

      // Merge the current batch of projects with allProjects
      Object.assign(allProjects, data);

      // Check if there are more projects to fetch
      hasMoreProjects = Object.values(data).some(
         (project) => (project as any)._more_projects === true
      );

      // Update the offset based on the number of projects in the current response
      start += Object.keys(data).length;
   }

   return allProjects;
};
