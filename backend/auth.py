"""Supabase JWT verification for FastAPI."""
import os
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from supabase import create_client, Client

from config import settings

# Supabase JWT secret (same as JWT Secret in Supabase Dashboard -> Settings -> API)
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET") or os.environ.get("JWT_SECRET")

# Fixed user id for dev-no-auth mode (no Supabase profile; credits/sessions in-memory only)
DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

security = HTTPBearer(auto_error=False)


def get_supabase_admin() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_current_user_id(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    x_dev_no_auth: Annotated[str | None, Header(alias="X-Dev-No-Auth")] = None,
) -> str:
    # Dev bypass: allow unauthenticated requests when ALLOW_DEV_NO_AUTH=1 and header is set
    if settings.allow_dev_no_auth and x_dev_no_auth == "1":
        return DEV_USER_ID
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server auth not configured (JWT_SECRET)",
        )
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token: no sub")
        return str(sub)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
