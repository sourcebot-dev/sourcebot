'use client';

import { useState } from "react";
import type { AskSkillCreationMethod } from "@/lib/posthogEvents";

export type CreateSkillDraftMethod = Extract<AskSkillCreationMethod, "manual" | "local_markdown">;

export const useCreateSkillDraftMethod = () => {
    const [createDraftMethod, setCreateDraftMethod] = useState<CreateSkillDraftMethod>("manual");

    return {
        createDraftMethod,
        markManualDraft: () => setCreateDraftMethod("manual"),
        markLocalMarkdownDraft: () => setCreateDraftMethod("local_markdown"),
        resetDraftMethod: () => setCreateDraftMethod("manual"),
    };
};
