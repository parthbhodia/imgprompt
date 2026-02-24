"""App configuration from environment."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    replicate_api_token: str = ""
    flux_model: str = "black-forest-labs/flux-schnell"
    groq_api_key: str = ""
    credits_per_generation: int = 1
    default_credits_new_user: int = 5
    # Dev only: allow API without sign-in when X-Dev-No-Auth: 1 header is sent (e.g. from localhost)
    allow_dev_no_auth: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
