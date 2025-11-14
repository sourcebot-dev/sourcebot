// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/webserver.proto

import type { Stats as _zoekt_webserver_v1_Stats, Stats__Output as _zoekt_webserver_v1_Stats__Output } from '../../../zoekt/webserver/v1/Stats';
import type { Progress as _zoekt_webserver_v1_Progress, Progress__Output as _zoekt_webserver_v1_Progress__Output } from '../../../zoekt/webserver/v1/Progress';
import type { FileMatch as _zoekt_webserver_v1_FileMatch, FileMatch__Output as _zoekt_webserver_v1_FileMatch__Output } from '../../../zoekt/webserver/v1/FileMatch';

export interface SearchResponse {
  'stats'?: (_zoekt_webserver_v1_Stats | null);
  'progress'?: (_zoekt_webserver_v1_Progress | null);
  'files'?: (_zoekt_webserver_v1_FileMatch)[];
}

export interface SearchResponse__Output {
  'stats': (_zoekt_webserver_v1_Stats__Output | null);
  'progress': (_zoekt_webserver_v1_Progress__Output | null);
  'files': (_zoekt_webserver_v1_FileMatch__Output)[];
}
