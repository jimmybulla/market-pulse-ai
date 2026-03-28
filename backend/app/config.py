from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    admin_secret: str = "dev-secret"
    env: str = "development"
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_contact_email: str = "admin@example.com"

    model_config = {"env_file": ".env"}


settings = Settings()
