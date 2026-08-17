"""
Central place for all configuration/env vars. Everything else in the backend
should import from here rather than calling os.environ directly, so there's
one place to see every setting the app depends on.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-only-insecure-key")
    ENV = os.environ.get("FLASK_ENV", "development")

    # Comma-separated list of origins allowed to call this API
    # (your task pane's localhost during dev, your extension's chrome-extension:// id in prod, etc.)
    FRONTEND_ORIGINS = os.environ.get("FRONTEND_ORIGINS", "*").split(",")

    OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
    # "openrouter/free" is OpenRouter's own auto-router -- it always points
    # at whatever free model is currently working, so your app doesn't
    # break when OpenRouter rotates/delists individual free models (this
    # happens often -- see note below). Override with a specific model ID
    # if you want to pin one, e.g. "nvidia/llama-3.1-nemotron-70b-instruct:free"
    OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openrouter/free")
    # Optional -- attributes your usage on OpenRouter's rankings, doesn't affect function
    OPENROUTER_SITE_URL = os.environ.get("OPENROUTER_SITE_URL", "")
    OPENROUTER_SITE_NAME = os.environ.get("OPENROUTER_SITE_NAME", "")

    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
    # Free tier never touches Stripe -- only Pro and Enterprise have a price ID.
    STRIPE_PRICE_ID_PRO = os.environ.get("STRIPE_PRICE_ID_PRO")
    STRIPE_PRICE_ID_ENTERPRISE = os.environ.get("STRIPE_PRICE_ID_ENTERPRISE")

    # Monthly request limits per tier. Purely a business decision -- change
    # these numbers freely, nothing else in the code needs to change.
    TIER_LIMITS = {
        "free": 50,
        "pro": 500,
        "enterprise": 5000,
    }

    # service_role key, not the anon/public key -- this bypasses RLS so the
    # backend can read/write any row. Never send this key to a frontend.
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
