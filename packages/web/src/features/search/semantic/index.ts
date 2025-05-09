import { SearchResponse, SemanticSearchRequest } from "../types";

export const semanticSearch = async (request: SemanticSearchRequest): Promise<SearchResponse> => {
    // todo
    console.log("semanticSearch", request);

    return {
        files: [],
        isBranchFilteringEnabled: false,
    }
}