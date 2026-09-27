# Deploying to Google Cloud

The app runs as **one Cloud Run service** that serves both the FastAPI API (`/api/...`) and the
built React frontend, behind **Identity-Aware Proxy (IAP)** so only approved Google accounts can open it.

| Piece | Resource (project `vahxa-student`, region `us-central1`) |
|-------|------------------------------------------------------------|
| App | Cloud Run service `vahxa-student` — https://vahxa-student-964042485803.us-central1.run.app |
| Image | Artifact Registry `us-central1-docker.pkg.dev/vahxa-student/vahxa/vahxa-student` |
| Database | Cloud SQL Postgres 16 `vahxa-student-db` (db-f1-micro), database `student_aid`, user `student_app` |
| DB connection | Secret Manager secret `database-url` → env `DATABASE_URL` |
| AI | Vertex AI — Gemma 4 (`google/gemma-4-26b-a4b-it-maas`, location `global`) |
| Curriculum library | Firestore `(default)` database (nam5), collection `curriculum_library` |
| Identity | Service account `student-app@vahxa-student.iam.gserviceaccount.com` — roles: Vertex AI User, Cloud Datastore User, Cloud SQL Client, and Secret Accessor on `database-url` |
| Access | IAP with a custom OAuth client (consent screen in *Testing*; users must be listed as test users) |

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

## Give someone access

1. Add them as a test user: Console → Google Auth Platform → **Audience** → *Test users*.
2. Grant IAP access:
   ```bash
   gcloud iap web add-iam-policy-binding --project=vahxa-student \
     --member=user:EMAIL --role=roles/iap.httpsResourceAccessor \
     --region=us-central1 --resource-type=cloud-run --service=vahxa-student
   ```

## Operations

- **Logs:** `gcloud run services logs read vahxa-student --project=vahxa-student --region=us-central1 --limit=50`
- **Roll back:** Console → Cloud Run → `vahxa-student` → *Revisions* → send 100% traffic to an earlier revision
  (or `gcloud run services update-traffic vahxa-student --to-revisions=REVISION=100 --region=us-central1`).
- **Backups:** Cloud SQL daily automated backups (08:00 UTC); restore from Console → SQL → *Backups*.
- **Cost:** Cloud SQL db-f1-micro is the main fixed cost (~$9–10/month). Cloud Run scales to zero when idle;
  Vertex AI (Gemma 4) and Firestore are pay-per-use and small at this scale.

## First-time setup (already done for `vahxa-student`)

Enabled APIs: Cloud Run, Cloud Build, Artifact Registry, Cloud SQL Admin, Secret Manager, IAP,
Cloud Resource Manager, Vertex AI, Firestore. Then created the Artifact Registry repo, the Cloud SQL
instance/database/user, the `database-url` secret, and deployed with:

```bash
gcloud run deploy vahxa-student --project=vahxa-student --region=us-central1 \
  --image=us-central1-docker.pkg.dev/vahxa-student/vahxa/vahxa-student:TAG \
  --service-account=student-app@vahxa-student.iam.gserviceaccount.com \
  --add-cloudsql-instances=vahxa-student:us-central1:vahxa-student-db \
  --set-secrets=DATABASE_URL=database-url:latest \
  --set-env-vars=VERTEX_PROJECT_ID=vahxa-student,VERTEX_LOCATION=global,CURRICULUM_LIBRARY_ENABLED=true \
  --no-allow-unauthenticated --iap \
  --min-instances=0 --max-instances=2 --memory=512Mi --cpu=1 --timeout=300
```

In a project without a Google Cloud organization, IAP needs a **custom OAuth client** for Gmail users:
create the consent screen (External, Testing) and a *Web application* OAuth client whose redirect URI is
`https://iap.googleapis.com/v1/oauth/clientIds/CLIENT_ID:handleRedirect`, then apply it with
`gcloud iap settings set` (`accessSettings.oauthSettings.clientId/clientSecret`) for the Cloud Run service.
