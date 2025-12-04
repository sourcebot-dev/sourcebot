import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { Duration as _google_protobuf_Duration, Duration__Output as _google_protobuf_Duration__Output } from './google/protobuf/Duration';
import type { Timestamp as _google_protobuf_Timestamp, Timestamp__Output as _google_protobuf_Timestamp__Output } from './google/protobuf/Timestamp';
import type { And as _zoekt_webserver_v1_And, And__Output as _zoekt_webserver_v1_And__Output } from './zoekt/webserver/v1/And';
import type { Boost as _zoekt_webserver_v1_Boost, Boost__Output as _zoekt_webserver_v1_Boost__Output } from './zoekt/webserver/v1/Boost';
import type { Branch as _zoekt_webserver_v1_Branch, Branch__Output as _zoekt_webserver_v1_Branch__Output } from './zoekt/webserver/v1/Branch';
import type { BranchRepos as _zoekt_webserver_v1_BranchRepos, BranchRepos__Output as _zoekt_webserver_v1_BranchRepos__Output } from './zoekt/webserver/v1/BranchRepos';
import type { BranchesRepos as _zoekt_webserver_v1_BranchesRepos, BranchesRepos__Output as _zoekt_webserver_v1_BranchesRepos__Output } from './zoekt/webserver/v1/BranchesRepos';
import type { ChunkMatch as _zoekt_webserver_v1_ChunkMatch, ChunkMatch__Output as _zoekt_webserver_v1_ChunkMatch__Output } from './zoekt/webserver/v1/ChunkMatch';
import type { FileMatch as _zoekt_webserver_v1_FileMatch, FileMatch__Output as _zoekt_webserver_v1_FileMatch__Output } from './zoekt/webserver/v1/FileMatch';
import type { FileNameSet as _zoekt_webserver_v1_FileNameSet, FileNameSet__Output as _zoekt_webserver_v1_FileNameSet__Output } from './zoekt/webserver/v1/FileNameSet';
import type { IndexMetadata as _zoekt_webserver_v1_IndexMetadata, IndexMetadata__Output as _zoekt_webserver_v1_IndexMetadata__Output } from './zoekt/webserver/v1/IndexMetadata';
import type { Language as _zoekt_webserver_v1_Language, Language__Output as _zoekt_webserver_v1_Language__Output } from './zoekt/webserver/v1/Language';
import type { LineFragmentMatch as _zoekt_webserver_v1_LineFragmentMatch, LineFragmentMatch__Output as _zoekt_webserver_v1_LineFragmentMatch__Output } from './zoekt/webserver/v1/LineFragmentMatch';
import type { LineMatch as _zoekt_webserver_v1_LineMatch, LineMatch__Output as _zoekt_webserver_v1_LineMatch__Output } from './zoekt/webserver/v1/LineMatch';
import type { ListOptions as _zoekt_webserver_v1_ListOptions, ListOptions__Output as _zoekt_webserver_v1_ListOptions__Output } from './zoekt/webserver/v1/ListOptions';
import type { ListRequest as _zoekt_webserver_v1_ListRequest, ListRequest__Output as _zoekt_webserver_v1_ListRequest__Output } from './zoekt/webserver/v1/ListRequest';
import type { ListResponse as _zoekt_webserver_v1_ListResponse, ListResponse__Output as _zoekt_webserver_v1_ListResponse__Output } from './zoekt/webserver/v1/ListResponse';
import type { Location as _zoekt_webserver_v1_Location, Location__Output as _zoekt_webserver_v1_Location__Output } from './zoekt/webserver/v1/Location';
import type { MinimalRepoListEntry as _zoekt_webserver_v1_MinimalRepoListEntry, MinimalRepoListEntry__Output as _zoekt_webserver_v1_MinimalRepoListEntry__Output } from './zoekt/webserver/v1/MinimalRepoListEntry';
import type { Not as _zoekt_webserver_v1_Not, Not__Output as _zoekt_webserver_v1_Not__Output } from './zoekt/webserver/v1/Not';
import type { Or as _zoekt_webserver_v1_Or, Or__Output as _zoekt_webserver_v1_Or__Output } from './zoekt/webserver/v1/Or';
import type { Progress as _zoekt_webserver_v1_Progress, Progress__Output as _zoekt_webserver_v1_Progress__Output } from './zoekt/webserver/v1/Progress';
import type { Q as _zoekt_webserver_v1_Q, Q__Output as _zoekt_webserver_v1_Q__Output } from './zoekt/webserver/v1/Q';
import type { Range as _zoekt_webserver_v1_Range, Range__Output as _zoekt_webserver_v1_Range__Output } from './zoekt/webserver/v1/Range';
import type { RawConfig as _zoekt_webserver_v1_RawConfig, RawConfig__Output as _zoekt_webserver_v1_RawConfig__Output } from './zoekt/webserver/v1/RawConfig';
import type { Regexp as _zoekt_webserver_v1_Regexp, Regexp__Output as _zoekt_webserver_v1_Regexp__Output } from './zoekt/webserver/v1/Regexp';
import type { Repo as _zoekt_webserver_v1_Repo, Repo__Output as _zoekt_webserver_v1_Repo__Output } from './zoekt/webserver/v1/Repo';
import type { RepoIds as _zoekt_webserver_v1_RepoIds, RepoIds__Output as _zoekt_webserver_v1_RepoIds__Output } from './zoekt/webserver/v1/RepoIds';
import type { RepoListEntry as _zoekt_webserver_v1_RepoListEntry, RepoListEntry__Output as _zoekt_webserver_v1_RepoListEntry__Output } from './zoekt/webserver/v1/RepoListEntry';
import type { RepoRegexp as _zoekt_webserver_v1_RepoRegexp, RepoRegexp__Output as _zoekt_webserver_v1_RepoRegexp__Output } from './zoekt/webserver/v1/RepoRegexp';
import type { RepoSet as _zoekt_webserver_v1_RepoSet, RepoSet__Output as _zoekt_webserver_v1_RepoSet__Output } from './zoekt/webserver/v1/RepoSet';
import type { RepoStats as _zoekt_webserver_v1_RepoStats, RepoStats__Output as _zoekt_webserver_v1_RepoStats__Output } from './zoekt/webserver/v1/RepoStats';
import type { Repository as _zoekt_webserver_v1_Repository, Repository__Output as _zoekt_webserver_v1_Repository__Output } from './zoekt/webserver/v1/Repository';
import type { RepositoryBranch as _zoekt_webserver_v1_RepositoryBranch, RepositoryBranch__Output as _zoekt_webserver_v1_RepositoryBranch__Output } from './zoekt/webserver/v1/RepositoryBranch';
import type { SearchOptions as _zoekt_webserver_v1_SearchOptions, SearchOptions__Output as _zoekt_webserver_v1_SearchOptions__Output } from './zoekt/webserver/v1/SearchOptions';
import type { SearchRequest as _zoekt_webserver_v1_SearchRequest, SearchRequest__Output as _zoekt_webserver_v1_SearchRequest__Output } from './zoekt/webserver/v1/SearchRequest';
import type { SearchResponse as _zoekt_webserver_v1_SearchResponse, SearchResponse__Output as _zoekt_webserver_v1_SearchResponse__Output } from './zoekt/webserver/v1/SearchResponse';
import type { Stats as _zoekt_webserver_v1_Stats, Stats__Output as _zoekt_webserver_v1_Stats__Output } from './zoekt/webserver/v1/Stats';
import type { StreamSearchRequest as _zoekt_webserver_v1_StreamSearchRequest, StreamSearchRequest__Output as _zoekt_webserver_v1_StreamSearchRequest__Output } from './zoekt/webserver/v1/StreamSearchRequest';
import type { StreamSearchResponse as _zoekt_webserver_v1_StreamSearchResponse, StreamSearchResponse__Output as _zoekt_webserver_v1_StreamSearchResponse__Output } from './zoekt/webserver/v1/StreamSearchResponse';
import type { Substring as _zoekt_webserver_v1_Substring, Substring__Output as _zoekt_webserver_v1_Substring__Output } from './zoekt/webserver/v1/Substring';
import type { Symbol as _zoekt_webserver_v1_Symbol, Symbol__Output as _zoekt_webserver_v1_Symbol__Output } from './zoekt/webserver/v1/Symbol';
import type { SymbolInfo as _zoekt_webserver_v1_SymbolInfo, SymbolInfo__Output as _zoekt_webserver_v1_SymbolInfo__Output } from './zoekt/webserver/v1/SymbolInfo';
import type { Type as _zoekt_webserver_v1_Type, Type__Output as _zoekt_webserver_v1_Type__Output } from './zoekt/webserver/v1/Type';
import type { WebserverServiceClient as _zoekt_webserver_v1_WebserverServiceClient, WebserverServiceDefinition as _zoekt_webserver_v1_WebserverServiceDefinition } from './zoekt/webserver/v1/WebserverService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  google: {
    protobuf: {
      Duration: MessageTypeDefinition<_google_protobuf_Duration, _google_protobuf_Duration__Output>
      Timestamp: MessageTypeDefinition<_google_protobuf_Timestamp, _google_protobuf_Timestamp__Output>
    }
  }
  zoekt: {
    webserver: {
      v1: {
        And: MessageTypeDefinition<_zoekt_webserver_v1_And, _zoekt_webserver_v1_And__Output>
        Boost: MessageTypeDefinition<_zoekt_webserver_v1_Boost, _zoekt_webserver_v1_Boost__Output>
        Branch: MessageTypeDefinition<_zoekt_webserver_v1_Branch, _zoekt_webserver_v1_Branch__Output>
        BranchRepos: MessageTypeDefinition<_zoekt_webserver_v1_BranchRepos, _zoekt_webserver_v1_BranchRepos__Output>
        BranchesRepos: MessageTypeDefinition<_zoekt_webserver_v1_BranchesRepos, _zoekt_webserver_v1_BranchesRepos__Output>
        ChunkMatch: MessageTypeDefinition<_zoekt_webserver_v1_ChunkMatch, _zoekt_webserver_v1_ChunkMatch__Output>
        FileMatch: MessageTypeDefinition<_zoekt_webserver_v1_FileMatch, _zoekt_webserver_v1_FileMatch__Output>
        FileNameSet: MessageTypeDefinition<_zoekt_webserver_v1_FileNameSet, _zoekt_webserver_v1_FileNameSet__Output>
        FlushReason: EnumTypeDefinition
        IndexMetadata: MessageTypeDefinition<_zoekt_webserver_v1_IndexMetadata, _zoekt_webserver_v1_IndexMetadata__Output>
        Language: MessageTypeDefinition<_zoekt_webserver_v1_Language, _zoekt_webserver_v1_Language__Output>
        LineFragmentMatch: MessageTypeDefinition<_zoekt_webserver_v1_LineFragmentMatch, _zoekt_webserver_v1_LineFragmentMatch__Output>
        LineMatch: MessageTypeDefinition<_zoekt_webserver_v1_LineMatch, _zoekt_webserver_v1_LineMatch__Output>
        ListOptions: MessageTypeDefinition<_zoekt_webserver_v1_ListOptions, _zoekt_webserver_v1_ListOptions__Output>
        ListRequest: MessageTypeDefinition<_zoekt_webserver_v1_ListRequest, _zoekt_webserver_v1_ListRequest__Output>
        ListResponse: MessageTypeDefinition<_zoekt_webserver_v1_ListResponse, _zoekt_webserver_v1_ListResponse__Output>
        Location: MessageTypeDefinition<_zoekt_webserver_v1_Location, _zoekt_webserver_v1_Location__Output>
        MinimalRepoListEntry: MessageTypeDefinition<_zoekt_webserver_v1_MinimalRepoListEntry, _zoekt_webserver_v1_MinimalRepoListEntry__Output>
        Not: MessageTypeDefinition<_zoekt_webserver_v1_Not, _zoekt_webserver_v1_Not__Output>
        Or: MessageTypeDefinition<_zoekt_webserver_v1_Or, _zoekt_webserver_v1_Or__Output>
        Progress: MessageTypeDefinition<_zoekt_webserver_v1_Progress, _zoekt_webserver_v1_Progress__Output>
        Q: MessageTypeDefinition<_zoekt_webserver_v1_Q, _zoekt_webserver_v1_Q__Output>
        Range: MessageTypeDefinition<_zoekt_webserver_v1_Range, _zoekt_webserver_v1_Range__Output>
        RawConfig: MessageTypeDefinition<_zoekt_webserver_v1_RawConfig, _zoekt_webserver_v1_RawConfig__Output>
        Regexp: MessageTypeDefinition<_zoekt_webserver_v1_Regexp, _zoekt_webserver_v1_Regexp__Output>
        Repo: MessageTypeDefinition<_zoekt_webserver_v1_Repo, _zoekt_webserver_v1_Repo__Output>
        RepoIds: MessageTypeDefinition<_zoekt_webserver_v1_RepoIds, _zoekt_webserver_v1_RepoIds__Output>
        RepoListEntry: MessageTypeDefinition<_zoekt_webserver_v1_RepoListEntry, _zoekt_webserver_v1_RepoListEntry__Output>
        RepoRegexp: MessageTypeDefinition<_zoekt_webserver_v1_RepoRegexp, _zoekt_webserver_v1_RepoRegexp__Output>
        RepoSet: MessageTypeDefinition<_zoekt_webserver_v1_RepoSet, _zoekt_webserver_v1_RepoSet__Output>
        RepoStats: MessageTypeDefinition<_zoekt_webserver_v1_RepoStats, _zoekt_webserver_v1_RepoStats__Output>
        Repository: MessageTypeDefinition<_zoekt_webserver_v1_Repository, _zoekt_webserver_v1_Repository__Output>
        RepositoryBranch: MessageTypeDefinition<_zoekt_webserver_v1_RepositoryBranch, _zoekt_webserver_v1_RepositoryBranch__Output>
        SearchOptions: MessageTypeDefinition<_zoekt_webserver_v1_SearchOptions, _zoekt_webserver_v1_SearchOptions__Output>
        SearchRequest: MessageTypeDefinition<_zoekt_webserver_v1_SearchRequest, _zoekt_webserver_v1_SearchRequest__Output>
        SearchResponse: MessageTypeDefinition<_zoekt_webserver_v1_SearchResponse, _zoekt_webserver_v1_SearchResponse__Output>
        Stats: MessageTypeDefinition<_zoekt_webserver_v1_Stats, _zoekt_webserver_v1_Stats__Output>
        StreamSearchRequest: MessageTypeDefinition<_zoekt_webserver_v1_StreamSearchRequest, _zoekt_webserver_v1_StreamSearchRequest__Output>
        StreamSearchResponse: MessageTypeDefinition<_zoekt_webserver_v1_StreamSearchResponse, _zoekt_webserver_v1_StreamSearchResponse__Output>
        Substring: MessageTypeDefinition<_zoekt_webserver_v1_Substring, _zoekt_webserver_v1_Substring__Output>
        Symbol: MessageTypeDefinition<_zoekt_webserver_v1_Symbol, _zoekt_webserver_v1_Symbol__Output>
        SymbolInfo: MessageTypeDefinition<_zoekt_webserver_v1_SymbolInfo, _zoekt_webserver_v1_SymbolInfo__Output>
        Type: MessageTypeDefinition<_zoekt_webserver_v1_Type, _zoekt_webserver_v1_Type__Output>
        WebserverService: SubtypeConstructor<typeof grpc.Client, _zoekt_webserver_v1_WebserverServiceClient> & { service: _zoekt_webserver_v1_WebserverServiceDefinition }
      }
    }
  }
}

