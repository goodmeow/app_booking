# Database scripts

Scripts here operate only on the disposable Compose service `postgres-test`.

Run Docker through a login shell after group membership refresh. During the current session, prefix Docker commands with:

```bash
sg docker -c 'docker compose ...'
```

Never adapt reset commands to production or shared databases.

Full disposable rebuild:

```bash
database/scripts/rebuild-test-db.sh
```

Script refuses any database name except `360booking_reconstruction_test`, applies all migrations, loads sanitized seed, then runs every SQL test.
