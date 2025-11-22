import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { And as _zoekt_webserver_v1_And, And__Output as _zoekt_webserver_v1_And__Output } from './zoekt/webserver/v1/And';
import type { Boost as _zoekt_webserver_v1_Boost, Boost__Output as _zoekt_webserver_v1_Boost__Output } from './zoekt/webserver/v1/Boost';
import type { Branch as _zoekt_webserver_v1_Branch, Branch__Output as _zoekt_webserver_v1_Branch__Output } from './zoekt/webserver/v1/Branch';
import type { BranchRepos as _zoekt_webserver_v1_BranchRepos, BranchRepos__Output as _zoekt_webserver_v1_BranchRepos__Output } from './zoekt/webserver/v1/BranchRepos';
import type { BranchesRepos as _zoekt_webserver_v1_BranchesRepos, BranchesRepos__Output as _zoekt_webserver_v1_BranchesRepos__Output } from './zoekt/webserver/v1/BranchesRepos';
import type { FileNameSet as _zoekt_webserver_v1_FileNameSet, FileNameSet__Output as _zoekt_webserver_v1_FileNameSet__Output } from './zoekt/webserver/v1/FileNameSet';
import type { Language as _zoekt_webserver_v1_Language, Language__Output as _zoekt_webserver_v1_Language__Output } from './zoekt/webserver/v1/Language';
import type { Not as _zoekt_webserver_v1_Not, Not__Output as _zoekt_webserver_v1_Not__Output } from './zoekt/webserver/v1/Not';
import type { Or as _zoekt_webserver_v1_Or, Or__Output as _zoekt_webserver_v1_Or__Output } from './zoekt/webserver/v1/Or';
import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from './zoekt/webserver/v1/Q';
import type { RawConfig as _zoekt_webserver_v1_RawConfig, RawConfig__Output as _zoekt_webserver_v1_RawConfig__Output } from './zoekt/webserver/v1/RawConfig';
import type { Regexp as _zoekt_webserver_v1_Regexp, Regexp__Output as _zoekt_webserver_v1_Regexp__Output } from './zoekt/webserver/v1/Regexp';
import type { Repo as _zoekt_webserver_v1_Repo, Repo__Output as _zoekt_webserver_v1_Repo__Output } from './zoekt/webserver/v1/Repo';
import type { RepoIds as _zoekt_webserver_v1_RepoIds, RepoIds__Output as _zoekt_webserver_v1_RepoIds__Output } from './zoekt/webserver/v1/RepoIds';
import type { RepoRegexp as _zoekt_webserver_v1_RepoRegexp, RepoRegexp__Output as _zoekt_webserver_v1_RepoRegexp__Output } from './zoekt/webserver/v1/RepoRegexp';
import type { RepoSet as _zoekt_webserver_v1_RepoSet, RepoSet__Output as _zoekt_webserver_v1_RepoSet__Output } from './zoekt/webserver/v1/RepoSet';
import type { Substring as _zoekt_webserver_v1_Substring, Substring__Output as _zoekt_webserver_v1_Substring__Output } from './zoekt/webserver/v1/Substring';
import type { Symbol as _zoekt_webserver_v1_Symbol, Symbol__Output as _zoekt_webserver_v1_Symbol__Output } from './zoekt/webserver/v1/Symbol';
import type { Type as _zoekt_webserver_v1_Type, Type__Output as _zoekt_webserver_v1_Type__Output } from './zoekt/webserver/v1/Type';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  zoekt: {
    webserver: {
      v1: {
        And: MessageTypeDefinition<_zoekt_webserver_v1_And, _zoekt_webserver_v1_And__Output>
        Boost: MessageTypeDefinition<_zoekt_webserver_v1_Boost, _zoekt_webserver_v1_Boost__Output>
        Branch: MessageTypeDefinition<_zoekt_webserver_v1_Branch, _zoekt_webserver_v1_Branch__Output>
        BranchRepos: MessageTypeDefinition<_zoekt_webserver_v1_BranchRepos, _zoekt_webserver_v1_BranchRepos__Output>
        BranchesRepos: MessageTypeDefinition<_zoekt_webserver_v1_BranchesRepos, _zoekt_webserver_v1_BranchesRepos__Output>
        FileNameSet: MessageTypeDefinition<_zoekt_webserver_v1_FileNameSet, _zoekt_webserver_v1_FileNameSet__Output>
        Language: MessageTypeDefinition<_zoekt_webserver_v1_Language, _zoekt_webserver_v1_Language__Output>
        Not: MessageTypeDefinition<_zoekt_webserver_v1_Not, _zoekt_webserver_v1_Not__Output>
        Or: MessageTypeDefinition<_zoekt_webserver_v1_Or, _zoekt_webserver_v1_Or__Output>
        Q: MessageTypeDefinition<_zoekt_webserver_v1_Q, _zoekt_webserver_v1_Q__Output>
        RawConfig: MessageTypeDefinition<_zoekt_webserver_v1_RawConfig, _zoekt_webserver_v1_RawConfig__Output>
        Regexp: MessageTypeDefinition<_zoekt_webserver_v1_Regexp, _zoekt_webserver_v1_Regexp__Output>
        Repo: MessageTypeDefinition<_zoekt_webserver_v1_Repo, _zoekt_webserver_v1_Repo__Output>
        RepoIds: MessageTypeDefinition<_zoekt_webserver_v1_RepoIds, _zoekt_webserver_v1_RepoIds__Output>
        RepoRegexp: MessageTypeDefinition<_zoekt_webserver_v1_RepoRegexp, _zoekt_webserver_v1_RepoRegexp__Output>
        RepoSet: MessageTypeDefinition<_zoekt_webserver_v1_RepoSet, _zoekt_webserver_v1_RepoSet__Output>
        Substring: MessageTypeDefinition<_zoekt_webserver_v1_Substring, _zoekt_webserver_v1_Substring__Output>
        Symbol: MessageTypeDefinition<_zoekt_webserver_v1_Symbol, _zoekt_webserver_v1_Symbol__Output>
        Type: MessageTypeDefinition<_zoekt_webserver_v1_Type, _zoekt_webserver_v1_Type__Output>
      }
    }
  }
}

