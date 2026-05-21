from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app.core.security import decode_access_token
from app.db.session import get_session
from app.models import User, UserRole


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)
) -> User:
    subject = decode_access_token(token)
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    user = session.get(User, int(subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin permission required")
    return current_user


def require_operator(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {UserRole.admin, UserRole.operator}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operator permission required")
    return current_user


def require_reviewer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {UserRole.admin, UserRole.reviewer}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Reviewer permission required")
    return current_user
