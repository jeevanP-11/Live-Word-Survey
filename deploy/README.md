# Deploying to a single EC2 instance behind an Elastic IP

No domain name required — the app is reached at `http://<elastic-ip>/...`.
The same `docker-compose.yml` used on a laptop runs unmodified on the
instance; there's no separate prod compose file to drift out of sync.

## One-time AWS setup (console or CLI, your choice)

1. Launch an EC2 instance (Amazon Linux 2023 or Ubuntu 22.04/24.04,
   `t3.small` or larger is comfortable for this workload).
2. Allocate and associate an **Elastic IP** with the instance.
3. Security group: allow inbound **TCP 80** (HTTP) from `0.0.0.0/0`, and
   **TCP 22** (SSH) from your IP.
4. Note the instance's public/Elastic IP and download the `.pem` key pair
   used to launch it.

Nothing else needs to be installed by hand — `deploy/ec2-setup.sh` handles
Docker + the Compose plugin.

## Configure the deploy script

```bash
cp deploy/.env.deploy.example deploy/.env.deploy
```

Edit `deploy/.env.deploy`:

```bash
EC2_HOST=203.0.113.10          # your Elastic IP
EC2_SSH_KEY=~/.ssh/my-key.pem
EC2_USER=ec2-user              # "ubuntu" if you launched an Ubuntu AMI
APP_DIR=/opt/survey-app        # remote path, rarely needs changing
```

This file is git-ignored — it's local machine config, not part of the app.

Also make sure you have real production values in the app's own `.env`:

```bash
cp .env.example .env
# edit .env: strong JWT_SECRET, real ADMIN_USERNAME/PASSWORD, DB password, etc.
```

## Deploy

```bash
./deploy/deploy-to-ec2.sh
```

What it does, in order:

1. **Runs the full local test suite** (`scripts/run-tests.sh`) — aborts
   immediately if anything fails, so a broken build never reaches the
   instance.
2. **One-time instance setup** — copies and runs `ec2-setup.sh` over SSH,
   which installs Docker + the Compose plugin (idempotent; safe to run
   again on an already-set-up instance) and creates `/opt/survey-app`.
3. **Syncs the source** to the instance via `rsync` (excludes
   `node_modules`, `dist`, `coverage`, `.git`, `.env`).
4. **Ships `.env`** separately via `scp` (kept out of the rsync exclude
   list intentionally, and never committed to git).
5. **Builds and starts the stack** on the instance: `docker compose build`
   then `docker compose up -d` — identical commands to a local run.
6. **Health-checks** `http://<EC2_HOST>/api/health` for up to ~30 seconds
   and prints the admin URL once it's up.

Re-running the script after making changes is the normal update flow —
it's fully idempotent (re-syncs, rebuilds, restarts).

## Operating the instance

```bash
ssh -i <key> <user>@<elastic-ip>
cd /opt/survey-app

docker compose ps            # container status
docker compose logs -f api   # tail API logs
docker compose logs -f web   # tail nginx logs
docker compose restart api   # restart just the API
docker compose down          # stop everything (add -v to also wipe the DB volume — careful!)
```

Postgres data lives in a named Docker volume (`db-data`) on the instance,
so it survives `docker compose down` / instance reboots as long as the
volume isn't explicitly removed.

## Rollback

There's no built-in image versioning — this is a small single-instance
deploy. To roll back, `git checkout` the previous commit locally and
re-run `./deploy/deploy-to-ec2.sh`; it will rsync the older source and
rebuild.
