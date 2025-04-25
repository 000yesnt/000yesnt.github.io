+++
title = "Properly backing up Docker Seafile's database"
date = 2025-04-17T22:21:53-03:00
draft = false
+++

*I wrote this post before I moved away from Seafile. I won't be updating it, but the commands here
should still work as long as Seafile continues to use MySQL/MariaDB.*

---

The Seafile Admin Manual [recommends using the following commands](https://manual.seafile.com/latest/administration/backup_recovery/#backing-up-database) to backup your database container:
```shell
cd /backup/databases
docker exec -it seafile-mysql mariadb-dump  -u[username] -p[password] --opt ccnet_db > ccnet_db.sql
docker exec -it seafile-mysql mariadb-dump  -u[username] -p[password] --opt seafile_db > seafile_db.sql
docker exec -it seafile-mysql mariadb-dump  -u[username] -p[password] --opt seahub_db > seahub_db.sql
```

This works, and creates full backups for the main Seafile databases, but there are a few caveats you should be aware of:
1. Original character sets are not saved. **This can cause files with Unicode names to be inacessible**, as well as a few other nasty errors and side effects.
2. It does not save the MySQL/MariaDB users. This is fine for the root user, but you'll have to manually create the db user after restoring.
3. You'll have to run a lot of commands to copy, restore and configure a fresh database container.

While points 2 and 3 are likely nitpicks, they are still important to me as, in the event of a catastrophic failure that requires a full restore, I'd rather spend as little of my own time and effort on recovery as possible.

# How I do it
I do not care about whatever benefits splitting the dump in three provides. If *any* of the databases become corrupted, I think it's a better idea to start fresh instead of possibly causing an invalid, desynced state between databases.

To backup all databases (including the internal ``mysql`` database containing user data) to one file, this is the command I use:
```shell
docker exec -it seafile-mysql mariadb-dump -h --username=root --password=[root_password] \
        --opt \
        --default-character-set=utf8mb4 \
        --skip-set-charset \
        --all-databases \
        --events \
        --routines \
        --triggers \
        --flush-privileges \
    > /path/to/your/seafile-backup.sql.`date +"%Y-%m-%d-%H-%M-%S"`
```
(Make sure to change ``mariadb-dump`` to ``mysqldump`` if you're using an older Seafile version!)

What each option does:
- ``--default-character-set=utf8mb4 --skip-set-charset``: Sets the default character set to UTF-8 and suppresses charset reconversion, preventing bugs with Unicode names;
- ``--all-databases --events --routines --triggers``: Self-explanatory. Gets all databases, their events, routines and triggers;
- ``--flush-privileges``: Required whenever the dump contains the ``mysql`` database (implied by ``--all-databases``). Sends a ``FLUSH PRIVILEGES`` statement to the database at the end of the dump.

The dump will have the current date appended to it.

## Recovering
Import it like any other mysql dump.

```shell
docker cp /path/to/your/seafile-backup.sql.2025-04-17-22-21-53 seafile-mysql:/tmp/seafile.sql
docker exec -it seafile-mysql /bin/sh -c "mysql -uroot -p[password] < /tmp/seafile.sql"
```
