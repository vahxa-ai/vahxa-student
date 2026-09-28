# Deploying to Google Cloud

The app runs as **one Cloud Run service** that serves both the FastAPI API (`/api/...`) and the
built React frontend. The service is public; access is controlled by the app itself — Google sign-in,
parental consent, and admin approval (see [Access control](#access-control)).

| Piece | Resource (project `vahxa-student`, region `us-central1`) |
|-------|------------------------------------------------------------|
| App | Cloud Run service `vahxa-student` — https://vahxa-student-964042485803.us-central1.run.app |
| Image | Artifact Registry `us-central1-docker.pkg.dev/vahxa-student/vahxa/vahxa-student` |
| Database | Cloud SQL Postgres 16 `vahxa-student-db` (db-f1-micro), database `student_aid`, user `student_app` |
| DB connection | Secret Manager secret `database-url` → env `DATABASE_URL` |
| AI | Vertex AI — Gemma 4 (`google/gemma-4-26b-a4b-it-maas`, location `global`) |
| Curriculum library | Firestore `(default)` database (nam5), collection `curriculum_library` |
| Identity | Service account `student-app@vahxa-student.iam.gserviceaccount.com` — roles: Vertex AI User, Cloud Datastore User, Cloud SQL Client, and Secret Accessor on `database-url`, `session-secret`, `smtp-password` |
| Sign-in | Google Identity Services with OAuth client `GOOGLE_OAUTH_CLIENT_ID` (consent screen published) → httpOnly session cookie signed with secret `session-secret` |
| Email | Gmail SMTP (`SMTP_USER`, app password in secret `smtp-password`) for parental-consent emails |

No key file is used in Cloud Run — the service authenticates as its attached service account.
`.dockerignore` / `.gcloudignore` keep `.env`, `*-key.json` and local databases out of the image.

## Redeploy after code changes

```bash
# from the repo root — build in Cloud Build (no local Docker needed)
TAG=$(git rev-parse --short HEAD)
gcloud builds submit --project=vahxa-student --region=us-central1 \
  --tag=us-central1-docker.pkg.dev/vahxa-student/vahxa/vahxa-student:$TAG .

# roll out the new image (all other settings are kept)
gcloud run deploy vahxa-student --project=vahxa-student --region=us-central1 \
  --image=us-central1-docker.pkg.dev/vahxa-student/vahxa/vahxa-student:$TAG
```

Schema changes that only **add nullable columns or new tables** are applied automatically on startup.
Anything else (renames, NOT NULL columns, type changes) needs a manual migration first.

## Access control

Cloud Run allows unauthenticated invocations (`allUsers` → `roles/run.invoker`) and IAP is **off**, so
anyone can reach the sign-in page. Every `/api` route except sign-in requires a session, and student
data is only served once the student is fully approved:

1. The student signs in with Google and enters a parent's email.
2. The parent receives a consent email and must sign in with **that** Google account to give consent.
3. An admin (`ADMIN_EMAILS`, currently `vahxa.ai@gmail.com`) approves the student on the **Admin** page.

No gcloud commands are needed to add a user. To make the service private again, turn IAP back on
(`gcloud run services update vahxa-student --iap ...`), remove the `allUsers` invoker binding, and grant
each user `roles/iap.httpsResourceAccessor` — students *and* parents then both need IAP access.

## Operations

- **Logs:** `gcloud run services logs read vahxa-student --project=vahxa-student --region=us-central1 --limit=50`
- **Roll back:** Console → Cloud Run → `vahxa-student` → *Revisions* → send 100% traffic to an earlier revision
  (or `gcloud run services update-traffic vahxa-student --to-revisions=REVISION=100 --region=us-central1`).
- **Backups:** Cloud SQL daily automated backups (08:00 UTC); restore from Console → SQL → *Backups*.
- **Cost:** Cloud SQL db-f1-micro is the main fixed cost (~$9–10/month). Cloud Run scales to zero when idle;
  Vertex AI (Gemma 4) and Firestore are pay-per-use and small at this scale.

## First-time setup (already done for `vahxa-student`)

Enabled APIs: Cloud Run, Cloud Build, Artifact Registry, Cloud SQL Admin, Secret Manager,
Cloud Resource Manager, Vertex AI, Firestore. Then created the Artifact Registry repo, the Cloud SQL
instance/database/user, the `database-url`, `session-secret` and `smtp-password` secrets, and deployed with:

```bash
gcloud run deploy vahxa-student --project=vahxa-student --region=us-central1 \
  --image=us-central1-docker.pkg.dev/vahxa-student/vahxa/vahxa-student:TAG \
  --service-account=student-app@vahxa-student.iam.gserviceaccount.com \
  --add-cloudsql-instances=vahxa-student:us-central1:vahxa-student-db \
  --set-secrets=DATABASE_URL=database-url:latest,SESSION_SECRET=session-secret:latest,SMTP_PASSWORD=smtp-password:latest \
  --set-env-vars=VERTEX_PROJECT_ID=vahxa-student,VERTEX_LOCATION=global,CURRICULUM_LIBRARY_ENABLED=true,GOOGLE_OAUTH_CLIENT_ID=CLIENT_ID,ADMIN_EMAILS=vahxa.ai@gmail.com,APP_BASE_URL=SERVICE_URL,SMTP_USER=SENDER@gmail.com,EMAIL_FROM=SENDER@gmail.com \
  --allow-unauthenticated \
  --min-instances=0 --max-instances=2 --memory=512Mi --cpu=1 --timeout=300
```

For Google sign-in, create the OAuth consent screen (External, then **publish** it so any Gmail user can
sign in) and a *Web application* OAuth client with the service URL (and `http://localhost:3000` for local
dev) under **Authorized JavaScript origins**; its client ID is `GOOGLE_OAUTH_CLIENT_ID`. For consent
emails, create a Gmail app password for the sender account and store it in the `smtp-password` secret.
