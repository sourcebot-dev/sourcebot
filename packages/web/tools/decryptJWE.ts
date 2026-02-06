import { decode } from 'next-auth/jwt';

const secret = process.env.AUTH_SECRET;
const token = process.argv[2];
// Salt is the cookie name used by next-auth (used in key derivation)
const salt = process.argv[3] || 'authjs.session-token';

if (!secret) {
    console.error('AUTH_SECRET environment variable is required');
    process.exit(1);
}

if (!token) {
    console.error('Usage: yarn tool:decrypt-jwe <jwe-token> [cookie-name]');
    console.error('  cookie-name defaults to "authjs.session-token"');
    console.error('  use "__Secure-authjs.session-token" for secure cookies (HTTPS)');
    process.exit(1);
}

async function decryptJWE() {
    const decoded = await decode({
        token,
        secret: secret!,
        salt,
    });
    console.log(JSON.stringify(decoded, null, 2));
}

decryptJWE().catch(err => {
    console.error('Failed to decrypt JWE:', err.message);
    process.exit(1);
});