/* eslint-disable @typescript-eslint/no-empty-object-type */

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
    wa_connect_code_host_button_pressed: {
        name: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_onboard_checkout_success: {},
    wa_onboard_checkout_fail: {
        errorCode: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_team_upgrade_card_pressed: {},
    wa_team_upgrade_checkout_success: {},
    wa_team_upgrade_checkout_fail: {
        errorCode: string,
    },
    wa_enterprise_upgrade_card_pressed: {},
    //////////////////////////////////////////////////////////////////
    wa_login_with_github: {},
    wa_login_with_google: {},
    wa_login_with_gitlab: {},
    wa_login_with_okta: {},
    wa_login_with_keycloak: {},
    wa_login_with_microsoft_entra_id: {},
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
    wa_chat_thread_created: {},
    wa_chat_message_sent: {
        messageCount: number,
    },
    wa_chat_tool_used: {
        toolName: string,
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
    //////////////////////////////////////////////////////////////////
    wa_demo_docs_link_pressed: {},
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
    api_code_search_request: {
        source: string;
        type: 'streamed' | 'blocking';
    },
    api_request: {
        path: string;
        source: string;
    },
} 
export type PosthogEvent = keyof PosthogEventMap;