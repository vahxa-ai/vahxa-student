from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Student AI Assistant"
    debug: bool = True
    secret_key: str = "dev-secret-key"

    # Database
    database_url: str = "sqlite+aiosqlite:///./student_aid.db"

    # Vertex AI — Gemma 4 (serverless MaaS). Auth via Application Default Credentials.
    vertex_project_id: str = ""   # empty = project from ADC / gcloud config
    vertex_location: str = "global"
    vertex_model: str = "google/gemma-4-26b-a4b-it-maas"
    # Optional service-account key file (relative paths resolve from backend/); empty = ADC
    google_credentials_file: str = ""

    # Shared curriculum library (Firestore) — reuse curricula across students in the same category
    curriculum_library_enabled: bool = True
    firestore_database: str = "(default)"
    curriculum_library_collection: str = "curriculum_library"

    # CORS
    frontend_url: str = "http://localhost:3000"

    # Path to the React build to serve from this service (set in the container); empty = API only
    frontend_dist: str = ""

    # ─── Accounts ─────────────────────────────────────────────────────────────
    # Web OAuth client used by "Sign in with Google" (ID tokens are verified against it)
    google_oauth_client_id: str = ""
    # Signs session cookies — set a long random value in production (Secret Manager)
    session_secret: str = ""
    session_days: int = 7
    cookie_secure: bool = True
    # Comma-separated admin emails
    admin_emails: str = ""
    # Public base URL used in emailed links, e.g. https://app.example.com
    app_base_url: str = "http://localhost:3000"
    # Bump when the parental consent wording changes; recorded with each consent
    consent_version: str = "2026-09-27"
    consent_link_days: int = 14

    # ─── Email (SMTP) ─────────────────────────────────────────────────────────
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""          # Gmail App Password (Secret Manager in production)
    email_from: str = ""             # defaults to smtp_user

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    class Config:
        env_file = ".env"


settings = Settings()
