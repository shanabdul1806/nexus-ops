# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (main) | Yes |
| older tags | No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report vulnerabilities privately by opening a [GitHub Security Advisory](https://github.com/ccdlvc/nexus-ops/security/advisories/new).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within 72 hours. If confirmed, a patch will be released and you will be credited in the release notes unless you prefer to remain anonymous.

## Security Best Practices for Deployment

- Never commit `.env` files — use environment variables or a secrets manager
- Rotate API keys and tokens regularly
- Run the backend behind a reverse proxy (nginx, Traefik) with TLS
- Restrict `ALLOWED_ORIGINS` to your dashboard domain only
- Use Docker secrets or a vault for production credentials
- The SQLite database (`data/`) contains alert and incident history — restrict file system access accordingly
