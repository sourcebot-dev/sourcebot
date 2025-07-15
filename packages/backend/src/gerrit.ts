import fetch from 'cross-fetch';
import { GerritConnectionConfig } from "@sourcebot/schemas/v3/index.type"
import { createLogger } from "@sourcebot/logger";
import micromatch from "micromatch";
import { measure, fetchWithRetry, getTokenFromConfig } from './utils.js';
import { BackendError } from '@sourcebot/error';
import { BackendException } from '@sourcebot/error';
import { PrismaClient } from "@sourcebot/db";
import * as Sentry from "@sentry/node";

// https://gerrit-review.googlesource.com/Documentation/rest-api.html
interface GerritProjects {
   [projectName: string]: GerritProjectInfo;
}

// https://gerrit-review.googlesource.com/Documentation/rest-api-projects.html#:~:text=date%20upon%20submit.-,state,-optional
type GerritProjectState = 'ACTIVE' | 'READ_ONLY' | 'HIDDEN';

interface GerritProjectInfo {
   id: string;
   state?: GerritProjectState;
   web_links?: GerritWebLink[];
}

export interface GerritProject {
   name: string;
   id: string;
   state?: GerritProjectState;
   web_links?: GerritWebLink[];
}

interface GerritWebLink {
   name: string;
   url: string;
}

interface GerritAuthConfig {
   username: string;
   password: string;
}

const logger = createLogger('gerrit');

export const getGerritReposFromConfig = async (
   config: GerritConnectionConfig, 
   orgId: number, 
   db: PrismaClient
): Promise<GerritProject[]> => {
   const url = config.url.endsWith('/') ? config.url : `${config.url}/`;
   const hostname = new URL(config.url).hostname;

   // Get authentication credentials if provided
   let auth: GerritAuthConfig | undefined;
   if (config.auth) {
      try {
         const password = await getTokenFromConfig(config.auth.password, orgId, db, logger);
         auth = {
            username: config.auth.username,
            password: password
         };
         logger.debug(`Using authentication for Gerrit instance ${hostname} with username: ${auth.username}`);
      } catch (error) {
         logger.error(`Failed to retrieve Gerrit authentication credentials: ${error}`);
         throw error;
      }
   }

   let { durationMs, data: projects } = await measure(async () => {
      try {
         const fetchFn = () => fetchAllProjects(url, auth);
         return fetchWithRetry(fetchFn, `projects from ${url}`, logger);
      } catch (err) {
         Sentry.captureException(err);
         if (err instanceof BackendException) {
            throw err;
         }

         logger.error(`Failed to fetch projects from ${url}`, err);
         return null;
      }
   });

   if (!projects) {
      const e = new Error(`Failed to fetch projects from ${url}`);
      Sentry.captureException(e);
      throw e;
   }

   // include repos by glob if specified in config
   if (config.projects) {
      projects = projects.filter((project) => {
         return micromatch.isMatch(project.name, config.projects!);
      });
   }

   projects = projects
      .filter((project) => {
         const isExcluded = shouldExcludeProject({
            project,
            exclude: config.exclude,
         });

         return !isExcluded;
      });

   logger.debug(`Fetched ${projects.length} projects in ${durationMs}ms.`);
   return projects;
};

const fetchAllProjects = async (url: string, auth?: GerritAuthConfig): Promise<GerritProject[]> => {
   // Use authenticated endpoint if auth is provided, otherwise use public endpoint
   // See: https://gerrit-review.googlesource.com/Documentation/rest-api.html#:~:text=Protocol%20Details-,Authentication,-By%20default%20all
   const projectsEndpoint = auth ? `${url}a/projects/` : `${url}projects/`;
   let allProjects: GerritProject[] = [];
   let start = 0; // Start offset for pagination
   let hasMoreProjects = true;

   // Prepare authentication headers if credentials are provided
   const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Sourcebot-Gerrit-Client/1.0'
   };

   if (auth) {
      const authString = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
      logger.debug(`Using HTTP Basic authentication for user: ${auth.username}`);
   }

   while (hasMoreProjects) {
      const endpointWithParams = `${projectsEndpoint}?S=${start}`;
      logger.debug(`Fetching projects from Gerrit at ${endpointWithParams} ${auth ? '(authenticated)' : '(public)'}`);

      let response: Response;
      try {
         response = await fetch(endpointWithParams, {
            method: 'GET',
            headers
         });
         
         if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            logger.error(`Failed to fetch projects from Gerrit at ${endpointWithParams} with status ${response.status}: ${errorText}`);
            const e = new BackendException(BackendError.CONNECTION_SYNC_FAILED_TO_FETCH_GERRIT_PROJECTS, {
               status: response.status,
               url: endpointWithParams,
               authenticated: !!auth
            });
            Sentry.captureException(e);
            throw e;
         }
      } catch (err) {
         Sentry.captureException(err);
         if (err instanceof BackendException) {
            throw err;
         }

         const status = (err as any).code;
         logger.error(`Failed to fetch projects from Gerrit at ${endpointWithParams} with status ${status}`);
         throw new BackendException(BackendError.CONNECTION_SYNC_FAILED_TO_FETCH_GERRIT_PROJECTS, {
            status: status,
            url: endpointWithParams,
            authenticated: !!auth
         });
      }

      const text = await response.text();
      // Remove XSSI protection prefix that Gerrit adds to JSON responses
      // The regex /^\)\]\}'\n/ matches the literal string ")]}'" at the start of the response
      // followed by a newline character, which Gerrit adds to prevent JSON hijacking
      const jsonText = text.startsWith(")]}'") ? text.replace(/^\)\]\}'\n/, '') : text;
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

   logger.debug(`Successfully fetched ${allProjects.length} projects ${auth ? '(authenticated)' : '(public)'}`);
   return allProjects;
};

export const shouldExcludeProject = ({
   project,
   exclude,
}: {
   project: GerritProject,
   exclude?: GerritConnectionConfig['exclude'],
}) => {
   let reason = '';

   const shouldExclude = (() => {
      if ([
            'All-Projects',
            'All-Users',
            'All-Avatars',
            'All-Archived-Projects'
         ].includes(project.name)) {
         reason = `Project is a special project.`;
         return true;
      }

      if (!!exclude?.readOnly && project.state === 'READ_ONLY') {
         reason = `\`exclude.readOnly\` is true`;
         return true;
      }

      if (!!exclude?.hidden && project.state === 'HIDDEN') {
         reason = `\`exclude.hidden\` is true`;
         return true;
      }

      if (exclude?.projects) {
         if (micromatch.isMatch(project.name, exclude.projects)) {
            reason = `\`exclude.projects\` contains ${project.name}`;
            return true;
         }
      }

      return false;
   })();

   if (shouldExclude) {
      logger.debug(`Excluding project ${project.name}. Reason: ${reason}`);
      return true;
   }

   return false;
}