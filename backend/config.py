"""App configuration from environment."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    replicate_api_token: str = ""
    flux_model: str = "black-forest-labs/flux-schnell"
    groq_api_key: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_popular: str = ""
    stripe_price_pro: str = ""
    app_url: str = "http://localhost:8080"
    credits_per_generation: int = 1
    default_credits_new_user: int = 5
    # Dev only: allow API without sign-in when X-Dev-No-Auth: 1 header is sent (e.g. from localhost)
    allow_dev_no_auth: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
