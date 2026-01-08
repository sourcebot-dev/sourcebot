// Original file: ../../vendor/zoekt/grpc/protos/zoekt/webserver/v1/query.proto

import type { RawConfig as _zoekt_webserver_v1_RawConfig, RawConfig__Output as _zoekt_webserver_v1_RawConfig__Output } from '../../../zoekt/webserver/v1/RawConfig';
import type { Regexp as _zoekt_webserver_v1_Regexp, Regexp__Output as _zoekt_webserver_v1_Regexp__Output } from '../../../zoekt/webserver/v1/Regexp';
import type { Symbol as _zoekt_webserver_v1_Symbol, Symbol__Output as _zoekt_webserver_v1_Symbol__Output } from '../../../zoekt/webserver/v1/Symbol';
import type { Language as _zoekt_webserver_v1_Language, Language__Output as _zoekt_webserver_v1_Language__Output } from '../../../zoekt/webserver/v1/Language';
import type { Repo as _zoekt_webserver_v1_Repo, Repo__Output as _zoekt_webserver_v1_Repo__Output } from '../../../zoekt/webserver/v1/Repo';
import type { RepoRegexp as _zoekt_webserver_v1_RepoRegexp, RepoRegexp__Output as _zoekt_webserver_v1_RepoRegexp__Output } from '../../../zoekt/webserver/v1/RepoRegexp';
import type { BranchesRepos as _zoekt_webserver_v1_BranchesRepos, BranchesRepos__Output as _zoekt_webserver_v1_BranchesRepos__Output } from '../../../zoekt/webserver/v1/BranchesRepos';
import type { RepoIds as _zoekt_webserver_v1_RepoIds, RepoIds__Output as _zoekt_webserver_v1_RepoIds__Output } from '../../../zoekt/webserver/v1/RepoIds';
import type { RepoSet as _zoekt_webserver_v1_RepoSet, RepoSet__Output as _zoekt_webserver_v1_RepoSet__Output } from '../../../zoekt/webserver/v1/RepoSet';
import type { FileNameSet as _zoekt_webserver_v1_FileNameSet, FileNameSet__Output as _zoekt_webserver_v1_FileNameSet__Output } from '../../../zoekt/webserver/v1/FileNameSet';
import type { Type as _zoekt_webserver_v1_Type, Type__Output as _zoekt_webserver_v1_Type__Output } from '../../../zoekt/webserver/v1/Type';
import type { Substring as _zoekt_webserver_v1_Substring, Substring__Output as _zoekt_webserver_v1_Substring__Output } from '../../../zoekt/webserver/v1/Substring';
import type { And as _zoekt_webserver_v1_And, And__Output as _zoekt_webserver_v1_And__Output } from '../../../zoekt/webserver/v1/And';
import type { Or as _zoekt_webserver_v1_Or, Or__Output as _zoekt_webserver_v1_Or__Output } from '../../../zoekt/webserver/v1/Or';
import type { Not as _zoekt_webserver_v1_Not, Not__Output as _zoekt_webserver_v1_Not__Output } from '../../../zoekt/webserver/v1/Not';
import type { Branch as _zoekt_webserver_v1_Branch, Branch__Output as _zoekt_webserver_v1_Branch__Output } from '../../../zoekt/webserver/v1/Branch';
import type { Boost as _zoekt_webserver_v1_Boost, Boost__Output as _zoekt_webserver_v1_Boost__Output } from '../../../zoekt/webserver/v1/Boost';

export interface Q {
  'raw_config'?: (_zoekt_webserver_v1_RawConfig | null);
  'regexp'?: (_zoekt_webserver_v1_Regexp | null);
  'symbol'?: (_zoekt_webserver_v1_Symbol | null);
  'language'?: (_zoekt_webserver_v1_Language | null);
  'const'?: (boolean);
  'repo'?: (_zoekt_webserver_v1_Repo | null);
  'repo_regexp'?: (_zoekt_webserver_v1_RepoRegexp | null);
  'branches_repos'?: (_zoekt_webserver_v1_BranchesRepos | null);
  'repo_ids'?: (_zoekt_webserver_v1_RepoIds | null);
  'repo_set'?: (_zoekt_webserver_v1_RepoSet | null);
  'file_name_set'?: (_zoekt_webserver_v1_FileNameSet | null);
  'type'?: (_zoekt_webserver_v1_Type | null);
  'substring'?: (_zoekt_webserver_v1_Substring | null);
  'and'?: (_zoekt_webserver_v1_And | null);
  'or'?: (_zoekt_webserver_v1_Or | null);
  'not'?: (_zoekt_webserver_v1_Not | null);
  'branch'?: (_zoekt_webserver_v1_Branch | null);
  'boost'?: (_zoekt_webserver_v1_Boost | null);
  'query'?: "raw_config"|"regexp"|"symbol"|"language"|"const"|"repo"|"repo_regexp"|"branches_repos"|"repo_ids"|"repo_set"|"file_name_set"|"type"|"substring"|"and"|"or"|"not"|"branch"|"boost";
}

export interface Q__Output {
  'raw_config'?: (_zoekt_webserver_v1_RawConfig__Output | null);
  'regexp'?: (_zoekt_webserver_v1_Regexp__Output | null);
  'symbol'?: (_zoekt_webserver_v1_Symbol__Output | null);
  'language'?: (_zoekt_webserver_v1_Language__Output | null);
  'const'?: (boolean);
  'repo'?: (_zoekt_webserver_v1_Repo__Output | null);
  'repo_regexp'?: (_zoekt_webserver_v1_RepoRegexp__Output | null);
  'branches_repos'?: (_zoekt_webserver_v1_BranchesRepos__Output | null);
  'repo_ids'?: (_zoekt_webserver_v1_RepoIds__Output | null);
  'repo_set'?: (_zoekt_webserver_v1_RepoSet__Output | null);
  'file_name_set'?: (_zoekt_webserver_v1_FileNameSet__Output | null);
  'type'?: (_zoekt_webserver_v1_Type__Output | null);
  'substring'?: (_zoekt_webserver_v1_Substring__Output | null);
  'and'?: (_zoekt_webserver_v1_And__Output | null);
  'or'?: (_zoekt_webserver_v1_Or__Output | null);
  'not'?: (_zoekt_webserver_v1_Not__Output | null);
  'branch'?: (_zoekt_webserver_v1_Branch__Output | null);
  'boost'?: (_zoekt_webserver_v1_Boost__Output | null);
  'query'?: "raw_config"|"regexp"|"symbol"|"language"|"const"|"repo"|"repo_regexp"|"branches_repos"|"repo_ids"|"repo_set"|"file_name_set"|"type"|"substring"|"and"|"or"|"not"|"branch"|"boost";
}
