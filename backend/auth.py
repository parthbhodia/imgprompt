"""Supabase JWT verification for FastAPI.

Uses supabase.auth.get_user() to validate tokens server-side — works with both
HS256 (older projects) and RS256 (newer projects) without needing JWT_SECRET.
"""
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client

from config import settings

# Fixed user id for dev-no-auth mode
DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

security = HTTPBearer(auto_error=False)


def get_supabase_admin() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_current_user_id(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    x_dev_no_auth: Annotated[str | None, Header(alias="X-Dev-No-Auth")] = None,
) -> str:
    # Dev bypass: allow unauthenticated requests when ALLOW_DEV_NO_AUTH=1 and header is sent
    if settings.allow_dev_no_auth and x_dev_no_auth == "1":
        return DEV_USER_ID

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        # Validate via Supabase Auth API — works for HS256 and RS256 alike
        client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        response = client.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return str(response.user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
