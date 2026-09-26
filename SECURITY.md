# Security policy

## Supported versions

Security fixes go into the latest release. If you're running an older version, update first and check whether the problem is still there.

## Reporting a vulnerability

Please **don't** open a public issue for a security problem.

Report it privately through GitHub's [private vulnerability reporting](https://github.com/SAKMZ/syncwave/security/advisories/new), or email **hello@awetomiq.com** with "Syncwave security" in the subject.

Include what you found, how to reproduce it, and which version you tested. You'll get a reply within a few days. Once a fix is released you're welcome to be credited in the release notes.

## Good to know when self-hosting

- Set the admin password at `/setup` straight away. Until it's set, anyone who can reach the server can claim it.
- API keys and proxy credentials entered in `/admin` are stored in `data/settings.json`. Keep that folder private and out of backups you share.
- Syncwave is meant for you and your friends. Don't run it as a public service; see the Legal section of the README.
