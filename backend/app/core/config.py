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

    # CORS
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
