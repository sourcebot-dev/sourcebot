import fetch from 'cross-fetch';
import { GerritConfig } from "@sourcebot/schemas/v2/index.type"
import { createLogger } from './logger.js';
import micromatch from "micromatch";
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

interface GerritProject {
   name: string;
   id: string;
   state?: string;
   web_links?: GerritWebLink[];
}

interface GerritWebLink {
   name: string;
   url: string;
}

const logger = createLogger('Gerrit');

export const getGerritReposFromConfig = async (config: GerritConfig): Promise<GerritProject[]> => {

   const url = config.url.endsWith('/') ? config.url : `${config.url}/`;
   const hostname = new URL(config.url).hostname;

   let { durationMs, data: projects } = await measure(async () => {
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
   const excludedProjects = ['All-Projects', 'All-Users', 'All-Avatars', 'All-Archived-Projects'];
   projects = projects.filter(project => !excludedProjects.includes(project.name));
   
   // include repos by glob if specified in config
   if (config.projects) {
      projects = projects.filter((project) => {
         return micromatch.isMatch(project.name, config.projects!);
      });
   }
   
   if (config.exclude && config.exclude.projects) {
      projects = projects.filter((project) => {
         return !micromatch.isMatch(project.name, config.exclude!.projects!);
      });
   }

   logger.debug(`Fetched ${Object.keys(projects).length} projects in ${durationMs}ms.`);
   return projects;
};

const fetchAllProjects = async (url: string): Promise<GerritProject[]> => {
   const projectsEndpoint = `${url}projects/`;
   let allProjects: GerritProject[] = [];
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

      // Add fetched projects to allProjects
      for (const [projectName, projectInfo] of Object.entries(data)) {
         allProjects.push({
            name: projectName,
            id: projectInfo.id,
            state: projectInfo.state,
            web_links: projectInfo.web_links
         })
      }

      // Check if there are more projects to fetch
      hasMoreProjects = Object.values(data).some(
         (project) => (project as any)._more_projects === true
      );

      // Update the offset based on the number of projects in the current response
      start += Object.keys(data).length;
   }

   return allProjects;
};
