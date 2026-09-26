from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Family AI Assistant"
    debug: bool = True
    secret_key: str = "dev-secret-key"

    # Database
    database_url: str = "sqlite+aiosqlite:///./family_aid.db"

    # Groq (free LLM)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Google Calendar
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/calendar/oauth/callback"

    # CORS
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
