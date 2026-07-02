/* eslint-disable @typescript-eslint/no-empty-object-type */

export type UpsellSource =
    'sidebar' |
    'analytics_settings' |
    'chat_box' |
    'chat' |
    'chats' |
    'onboard' |
    'license_settings' |
    'mcp_settings' |
    'sso_settings' |
    'scim_settings' |
    'chat_connectors';

export type SourcebotWebClientSource = 'sourcebot-web-client';
export type AskMcpAnalyticsSource = SourcebotWebClientSource | 'sourcebot-ask-agent';
export type McpConnectorEntryPoint = 'chat' | 'account_settings' | 'workspace_settings' | 'unknown';
export type McpConnectorAuthMode = 'dynamic' | 'static';

export type PosthogEventMap = {
    search_finished: {
        contentBytesLoaded: number,
        indexBytesLoaded: number,
        crashes: number,
        /** @deprecated: use timeToFirstSearchResultMs and timeToSearchCompletionMs instead */
        durationMs: number,
        timeToFirstSearchResultMs: number,
        timeToSearchCompletionMs: number,
        fileCount: number,
        shardFilesConsidered: number,
        filesConsidered: number,
        filesLoaded: number,
        filesSkipped: number,
        shardsScanned: number,
        shardsSkipped: number,
        shardsSkippedFilter: number,
        matchCount: number,
        actualMatchCount: number,
        ngramMatches: number,
        ngramLookups: number,
        wait: number,
        matchTreeConstruction: number,
        matchTreeSearch: number,
        regexpsConsidered: number,
        flushReason: string,
        fileLanguages: string[],
        isSearchExhaustive: boolean,
        isBranchFilteringEnabled: boolean,
    },
    ////////////////////////////////////////////////////////////////
    wa_trial_nav_pressed: {},
    wa_trial_nav_subscription_fetch_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_config_editor_quick_action_pressed: {
        name: string,
        type: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_billing_email_updated_success: {},
    wa_billing_email_updated_fail: {
        errorCode: string,
    },
    wa_manage_subscription_button_create_portal_session_success: {},
    wa_manage_subscription_button_create_portal_session_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_invite_member_card_invite_success: {
        num_emails: number,
    },
    wa_invite_member_card_invite_fail: {
        errorCode: string,
        num_emails: number,
    },
    wa_invite_member_card_invite_cancel: {
        num_emails: number,
    },
    //////////////////////////////////////////////////////////////////
    wa_members_list_remove_member_success: {},
    wa_members_list_remove_member_fail: {
        errorCode: string,
    },
    wa_members_list_transfer_ownership_success: {},
    wa_members_list_transfer_ownership_fail: {
        errorCode: string,
    },
    wa_members_list_promote_to_owner_success: {},
    wa_members_list_promote_to_owner_fail: {
        errorCode: string,
    },
    wa_members_list_demote_to_member_success: {},
    wa_members_list_demote_to_member_fail: {
        errorCode: string,
    },
    wa_members_list_leave_org_success: {},
    wa_members_list_leave_org_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_invites_list_cancel_invite_success: {},
    wa_invites_list_cancel_invite_fail: {
        errorCode: string,
    },
    wa_invites_list_copy_invite_link_success: {},
    wa_invites_list_copy_invite_link_fail: {},
    wa_invites_list_copy_email_success: {},
    wa_invites_list_copy_email_fail: {},
    //////////////////////////////////////////////////////////////////
    wa_upsell_dialog_viewed: {
        source: UpsellSource,
    },
    wa_upsell_checkout_started: {
        source: UpsellSource,
        requestTrial: boolean,
        interval: 'month' | 'year',
        returnPath: string,
        quantity: number,
    },
    wa_onboard_trial_step_viewed: {
        isTrialEligible: boolean,
    },
    wa_onboard_trial_step_skipped: {
        isTrialEligible: boolean,
    },
    //////////////////////////////////////////////////////////////////
    wa_login_with_github: {},
    wa_login_with_google: {},
    wa_login_with_gitlab: {},
    wa_login_with_okta: {},
    wa_login_with_keycloak: {},
    wa_login_with_microsoft_entra_id: {},
    wa_login_with_jumpcloud: {},
    wa_login_with_magic_link: {},
    wa_login_with_credentials: {},
    //////////////////////////////////////////////////////////////////
    wa_mobile_unsupported_splash_screen_dismissed: {},
    wa_mobile_unsupported_splash_screen_displayed: {},
    //////////////////////////////////////////////////////////////////
    wa_login_verify_page_no_email: {},
    //////////////////////////////////////////////////////////////////
    wa_org_name_updated_success: {},
    wa_org_name_updated_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_org_domain_updated_success: {},
    wa_org_domain_updated_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_security_page_click: {},
    //////////////////////////////////////////////////////////////////
    wa_demo_try_card_pressed: {},
    wa_share_link_created: {},
    //////////////////////////////////////////////////////////////////
    $pageview: {
        $current_url: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_requests_list_approve_request_success: {},
    wa_requests_list_approve_request_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_requests_list_reject_request_success: {},
    wa_requests_list_reject_request_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_api_key_created: {},
    wa_api_key_creation_fail: {},
    //////////////////////////////////////////////////////////////////
    wa_chat_feedback_submitted: {
        feedback: 'like' | 'dislike',
        chatId: string,
        messageId: string,
    },
    ask_thread_created: {
        chatId: string,
        isAnonymous: boolean,
        source?: string,
    },
    ask_message_sent: {
        chatId: string,
        messageCount: number,
        selectedReposCount: number,
        source?: string,
        /**
         * The configured AI provider type (e.g. 'anthropic', 'openai') and
         * model ID for the language model used to handle this message.
         */
        modelProvider: string,
        model: string,
        hasAskMcpServersAvailable: boolean,
        askMcpConnectedServerCount: number,
        askMcpEnabledServerCount: number,
        askMcpDisabledServerCount: number,
        /**
         * @note this field will only be populated when
         * the EXPERIMENT_ASK_GH_ENABLED environment variable
         * is set to true.
         */
        selectedRepos?: string[],
    },
    chat_attachment_uploaded: {
        source: string,
        mediaType: string,
        sizeBytes: number,
    },
    chat_attachment_degraded: {
        chatId: string,
        source: string,
        droppedImageCount: number,
        modelProvider: string,
        model: string,
    },
    ask_mcp_turn_completed: {
        chatId: string,
        source?: SourcebotWebClientSource,
        traceId?: string,
        askMcpUsed: boolean,
        askMcpToolCallCount: number,
        askMcpToolSuccessCount: number,
        askMcpToolFailureCount: number,
        askMcpApprovalRequestedCount: number,
        askMcpApprovalDeniedCount: number,
        askMcpFailedServerCount: number,
        durationMs: number,
    },
    ask_mcp_tool_call_completed: {
        chatId?: string,
        traceId?: string,
        source: AskMcpAnalyticsSource,
        serverId: string,
        serverUrl: string,
        toolName: string,
        success: boolean,
        durationMs: number,
        failureReason?: string,
    },
    // Fired when an agent skill is invoked, either automatically by the model
    // (activationMethod: 'auto', via the load_skill tool) or manually by the
    // user (activationMethod: 'manual', via a slash command). Multi-source, so
    // no wa_ prefix; source identifies the origin.
    ask_skill_invoked: {
        chatId?: string,
        traceId?: string,
        source: AskMcpAnalyticsSource,
        activationMethod: 'auto' | 'manual',
        skillId: string,
        slug?: string,
        name?: string,
        sourceLabel?: string,
        success: boolean,
        durationMs?: number,
    },
    ask_mcp_connector_added: {
        source: SourcebotWebClientSource,
        entryPoint: 'workspace_settings',
        serverId: string,
        serverUrl: string,
        authMode: McpConnectorAuthMode,
    },
    ask_mcp_connector_removed: {
        source: SourcebotWebClientSource,
        entryPoint: 'workspace_settings',
        serverId: string,
        serverUrl: string,
        authMode: McpConnectorAuthMode,
    },
    ask_mcp_connector_connection_started: {
        source: SourcebotWebClientSource,
        entryPoint: McpConnectorEntryPoint,
        serverId: string,
        serverUrl: string,
        authMode: McpConnectorAuthMode,
    },
    ask_mcp_connector_connection_completed: {
        source: SourcebotWebClientSource,
        entryPoint: McpConnectorEntryPoint,
        serverId: string,
        serverUrl: string,
        authMode: McpConnectorAuthMode,
        alreadyAuthorized: boolean,
    },
    ask_mcp_connector_connection_failed: {
        source: SourcebotWebClientSource,
        entryPoint: McpConnectorEntryPoint,
        serverId?: string,
        serverUrl?: string,
        authMode?: McpConnectorAuthMode,
        failureReason: string,
    },
    ask_mcp_connector_disconnected: {
        source: SourcebotWebClientSource,
        entryPoint: McpConnectorEntryPoint,
        serverId: string,
        serverUrl: string,
        authMode: McpConnectorAuthMode,
    },
    tool_used: {
        toolName: string,
        source: string,
        success: boolean,
    },
    wa_chat_share_dialog_opened: {
        chatId: string,
        currentVisibility: 'PUBLIC' | 'PRIVATE',
    },
    wa_chat_visibility_changed: {
        chatId: string,
        fromVisibility: 'PUBLIC' | 'PRIVATE',
        toVisibility: 'PUBLIC' | 'PRIVATE',
    },
    wa_chat_link_copied: {
        chatId: string,
        visibility: 'PUBLIC' | 'PRIVATE',
    },
    wa_chat_users_invited: {
        chatId: string,
        numUsersInvited: number,
    },
    wa_chat_user_removed: {
        chatId: string,
    },
    wa_shared_chat_viewed: {
        chatId: string,
        visibility: 'PUBLIC' | 'PRIVATE',
        viewerType: 'authenticated' | 'anonymous',
        accessType: 'public_link' | 'direct_invite',
    },
    wa_chat_sign_in_banner_displayed: {
        chatId: string,
    },
    wa_chat_sign_in_banner_dismissed: {
        chatId: string,
    },
    wa_chat_sign_in_banner_clicked: {
        chatId: string,
    },
    wa_anonymous_chats_claimed: {
        claimedCount: number,
    },
    wa_chat_duplicated: {
        chatId: string,
    },
    wa_chat_renamed: {
        chatId: string,
    },
    wa_chat_deleted: {
        chatId: string,
    },
    wa_chat_details_card_toggled: {
        chatId: string,
        isExpanded: boolean,
    },
    wa_chat_copy_answer_pressed: {
        chatId: string,
    },
    wa_chat_toc_toggled: {
        chatId: string,
        isExpanded: boolean,
    },
    wa_chat_diagram_rendered: {
        chatId: string,
        diagramId: string,
        outcome: 'success' | 'error',
        /** Mermaid diagram type (e.g. 'flowchart', 'sequenceDiagram'), if detectable. */
        diagramType?: string,
    },
    wa_chat_diagram_fullscreen_opened: {
        chatId: string,
        diagramId: string,
    },
    wa_chat_diagram_copied: {
        chatId: string,
        diagramId: string,
        format: 'link' | 'source' | 'image',
    },
    wa_chat_diagram_exported: {
        chatId: string,
        diagramId: string,
        format: 'svg' | 'png',
    },
    wa_chat_diagram_panned: {
        chatId: string,
        diagramId: string,
    },
    wa_chat_diagram_reference_clicked: {
        chatId: string,
        diagramId: string,
    },
    wa_user_created: {
        userId: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_askgh_login_wall_prompted: {},
    //////////////////////////////////////////////////////////////////
    wa_demo_docs_link_pressed: {},
    wa_search_assist_opened: {},
    wa_search_assist_query_generated: {},
    wa_search_assist_generate_failed: {},
    wa_search_assist_example_clicked: {
        example: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_demo_search_example_card_pressed: {
        exampleTitle: string,
        exampleUrl: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_github_star_toast_displayed: {},
    wa_github_star_toast_clicked: {},
    //////////////////////////////////////////////////////////////////
    wa_goto_definition_pressed: {
        source: 'chat' | 'browse' | 'preview',
    },
    wa_find_references_pressed: {
        source: 'chat' | 'browse' | 'preview',
    },
    wa_symbol_hover_popup_definitions_loaded: {
        durationMs: number,
    },
    wa_explore_menu_reference_clicked: {},
    wa_explore_menu_references_loaded: {
        durationMs: number,
        // Whether or not the user is searching all repositories.
        isGlobalSearchEnabled: boolean,
    },
    wa_explore_menu_definitions_loaded: {
        durationMs: number,
        // Whether or not the user is searching all repositories.
        isGlobalSearchEnabled: boolean,
    },
    //////////////////////////////////////////////////////////////////
    wa_file_tree_loaded: {
        durationMs: number,
    },
    //////////////////////////////////////////////////////////////////
    wa_repo_not_found_for_zoekt_file: {},
    //////////////////////////////////////////////////////////////////
    api_request: {
        path: string;
        source: string;
        method: string;
    },
    //////////////////////////////////////////////////////////////////
    wa_oauth_consent_viewed: {
        clientId: string,
        clientName: string,
    },
    wa_oauth_authorization_approved: {
        clientId: string,
        clientName: string,
    },
    wa_oauth_authorization_denied: {
        clientId: string,
        clientName: string,
    },
} 
export type PosthogEvent = keyof PosthogEventMap;
