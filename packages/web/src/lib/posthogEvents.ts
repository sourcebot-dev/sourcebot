/* eslint-disable @typescript-eslint/no-empty-object-type */

export type PosthogEventMap = {
    search_finished: {
        contentBytesLoaded: number,
        indexBytesLoaded: number,
        crashes: number,
        durationMs: number,
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
        flushReason: number,
        fileLanguages: string[]
    },
    share_link_created: {},
    ////////////////////////////////////////////////////////////////
    wa_secret_created_success: {
        key: string,
    },
    wa_secret_deleted_success: {
        key: string,
    },
    wa_secret_deleted_fail: {
        key: string,
        error: string,
    },
    wa_secret_created_fail: {
        key: string,
        error: string,
    },
    wa_secret_fetch_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_warning_nav_connection_fetch_fail: {
        error: string,
    },
    wa_warning_nav_hover: {},
    wa_warning_nav_pressed: {},
    wa_warning_nav_connection_pressed: {},
    //////////////////////////////////////////////////////////////////
    wa_error_nav_connection_fetch_fail: {
        error: string,
    },
    wa_error_nav_hover: {},
    wa_error_nav_pressed: {},
    wa_error_nav_job_pressed: {},
    wa_error_nav_job_fetch_fail: {
        error: string,
    },  
    //////////////////////////////////////////////////////////////////
    wa_progress_nav_connection_fetch_fail: {
        error: string,
    },
    wa_progress_nav_repo_fetch_fail: {
        error: string,
    },
    wa_progress_nav_hover: {},
    wa_progress_nav_pressed: {},
    wa_progress_nav_job_pressed: {},
    //////////////////////////////////////////////////////////////////
    wa_trial_nav_pressed: {},
    wa_trial_nav_subscription_fetch_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_connection_list_item_error_hover: {},
    wa_connection_list_item_error_pressed: {},
    wa_connection_list_item_warning_hover: {},
    wa_connection_list_item_warning_pressed: {},
    //////////////////////////////////////////////////////////////////
    wa_connection_list_item_manage_pressed: {},
    //////////////////////////////////////////////////////////////////
    wa_create_connection_success: {
        type: string,
    },
    wa_create_connection_fail: {
        type: string,
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_config_editor_quick_action_pressed: {
        name: string,
        type: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_secret_combobox_import_secret_pressed: {
        type: string,
    },
    wa_secret_combobox_import_secret_success: {
        type: string,
    },
    wa_secret_combobox_import_secret_fail: {
        type: string,
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_billing_email_updated_success: {},
    wa_billing_email_updated_fail: {
        error: string,
    },
    wa_billing_email_fetch_fail: {
        error: string,
    },
    wa_manage_subscription_button_create_portal_session_success: {},
    wa_manage_subscription_button_create_portal_session_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_invite_member_card_invite_success: {
        num_emails: number,
    },
    wa_invite_member_card_invite_fail: {
        error: string,
        num_emails: number,
    },
    wa_invite_member_card_invite_cancel: {
        num_emails: number,
    },
    //////////////////////////////////////////////////////////////////
    wa_onboard_skip_onboarding: {
        step: string,
    },
    wa_onboard_invite_team_invite_success: {
        num_emails: number,
    },
    wa_onboard_invite_team_invite_fail: {
        error: string,
        num_emails: number,
    },
    wa_onboard_invite_team_skip: {
        num_emails: number,
    },
    //////////////////////////////////////////////////////////////////
    wa_members_list_remove_member_success: {},
    wa_members_list_remove_member_fail: {
        error: string,
    },
    wa_members_list_leave_org_success: {},
    wa_members_list_leave_org_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_invites_list_cancel_invite_success: {},
    wa_invites_list_cancel_invite_fail: {
        error: string,
    },
    wa_invites_list_copy_invite_link_success: {},
    wa_invites_list_copy_invite_link_fail: {},
    wa_invites_list_copy_email_success: {},
    wa_invites_list_copy_email_fail: {},
    //////////////////////////////////////////////////////////////////
    wa_onboard_org_create_success: {},
    wa_onboard_org_create_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_connect_code_host_button_pressed: {
        name: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_onboard_checkout_success: {},
    wa_onboard_checkout_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_team_upgrade_card_pressed: {},
    wa_team_upgrade_checkout_success: {},
    wa_team_upgrade_checkout_fail: {
        error: string,
    },
    wa_enterprise_upgrade_card_pressed: {},
    //////////////////////////////////////////////////////////////////
    wa_connection_delete_success: {},
    wa_connection_delete_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_connection_failed_status_hover: {},
    wa_connection_retry_sync_success: {},
    wa_connection_retry_sync_fail: {
        error: string,
    },  
    //////////////////////////////////////////////////////////////////
    wa_connection_not_found_warning_displayed: {},
    wa_connection_secrets_navigation_pressed: {},
    //////////////////////////////////////////////////////////////////
    wa_connection_retry_all_failed_repos_pressed: {},
    wa_connection_retry_all_failed_repos_fetch_fail: {  
        error: string,
    },
    wa_connection_retry_all_failed_repos_fail: {},
    wa_connection_retry_all_failed_repos_success: {},
    wa_connection_retry_all_failed_no_repos: {},
    //////////////////////////////////////////////////////////////////
    wa_repo_retry_index_success: {},
    wa_repo_retry_index_fail: {
        error: string,
    },
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
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_org_domain_updated_success: {},
    wa_org_domain_updated_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_onboard_github_selected: {},
    wa_onboard_gitlab_selected: {},
    wa_onboard_gitea_selected: {},
    wa_onboard_gerrit_selected: {},
    wa_onboard_bitbucket_cloud_selected: {},
    wa_onboard_bitbucket_server_selected: {},
    //////////////////////////////////////////////////////////////////
    wa_security_page_click: {},
    //////////////////////////////////////////////////////////////////
    wa_demo_card_click: {},
    wa_demo_try_card_pressed: {},
    wa_share_link_created: {},
    //////////////////////////////////////////////////////////////////
    $pageview: {
        $current_url: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_requests_list_approve_request_success: {},
    wa_requests_list_approve_request_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_requests_list_reject_request_success: {},
    wa_requests_list_reject_request_fail: {
        error: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_api_key_created: {},
    wa_api_key_creation_fail: {},
    //////////////////////////////////////////////////////////////////
    wa_goto_definition_pressed: {
        source: 'chat' | 'browse' | 'preview',
    },
    wa_find_references_pressed: {
        source: 'chat' | 'browse' | 'preview',
    },
    //////////////////////////////////////////////////////////////////
    wa_explore_menu_reference_clicked: {},
    //////////////////////////////////////////////////////////////////
    wa_chat_feedback_submitted: {
        feedback: 'like' | 'dislike',
        chatId: string,
        messageId: string,
    },
    wa_chat_thread_created: {},
    //////////////////////////////////////////////////////////////////
    wa_demo_docs_link_pressed: {},
    wa_demo_search_context_card_pressed: {
        contextType: string,
        contextName: string,
        contextDisplayName: string,
    },
    wa_demo_search_example_card_pressed: {
        exampleTitle: string,
        exampleUrl: string,
    },
    //////////////////////////////////////////////////////////////////
    wa_github_star_toast_displayed: {},
    wa_github_star_toast_clicked: {},
} 
export type PosthogEvent = keyof PosthogEventMap;