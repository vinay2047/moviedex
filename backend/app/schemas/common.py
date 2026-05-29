"""Common response schemas — pagination and envelope."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    limit: int
    offset: int
    total: int


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[Any]  # Generic list; actual type enforced at call site
    pagination: PaginationMeta


class SingleResponse(BaseModel, Generic[T]):
    data: Any  # Generic single item


class ErrorResponse(BaseModel):
    error: str
