import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    admin_secret: str = "dev-secret"
    env: str = "development"
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    # Required in production: set VAPID_CONTACT_EMAIL in your environment
    vapid_contact_email: str = "admin@example.com"
    newsapi_key: str = ""

    model_config = {"env_file": ".env"}

    @model_validator(mode="after")
    def warn_missing_vapid_keys(self) -> "Settings":
        if self.env != "development" and not self.vapid_private_key:
            logger.warning(
                "VAPID_PRIVATE_KEY is not set — push notifications will not work in %s",
                self.env,
            )
        return self


settings = Settings()
