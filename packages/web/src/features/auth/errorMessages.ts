const ERROR_CONTENT: Record<string, { title: string; description: string }> = {
    CredentialsSignin: {
        title: "Unable to sign in",
        description: "Invalid email or password. Please try again.",
    },
    OAuthAccountNotLinked: {
        title: "Different sign-in method required",
        description: "This email is already associated with a different sign-in method.",
    },
    OAuthCallbackError: {
        title: "Provider sign-in failed",
        description: "Sign-in with your identity provider was cancelled or could not be completed. Please try again. If this continues, contact your administrator.",
    },
    MissingCSRF: {
        title: "Sign-in security check failed",
        description: "We couldn't verify your sign-in request. Refresh the page and try again.",
    },
    AccountNotLinked: {
        title: "Account not linked",
        description: "This account isn't linked to your Sourcebot user. Sign in using your original method, then link the account in Settings.",
    },
    WebAuthnVerificationError: {
        title: "Passkey verification failed",
        description: "We couldn't verify your passkey. Please try again or use another available sign-in method.",
    },
    Configuration: {
        title: "Server configuration error",
        description: "There is a problem with the server's authentication configuration. Please contact your administrator.",
    },
    AccessDenied: {
        title: "Access denied",
        description: "You do not have permission to sign in.",
    },
    EmailRequired: {
        title: "No email on your account",
        description: "Your identity provider didn't share an email address, which Sourcebot requires to sign you in. Add or verify an email on your upstream account, then try again.",
    },
    Verification: {
        title: "This sign-in link has expired",
        description: "The code or link you used is no longer valid - it may have expired or already been used. Request a new one and try again.",
    },
    Default: {
        title: "Unable to sign in",
        description: "An error occurred during authentication. Please try again.",
    },
};

export const getAuthErrorContent = (error: string | null | undefined) =>
    error && Object.hasOwn(ERROR_CONTENT, error) ? ERROR_CONTENT[error] : ERROR_CONTENT.Default;
