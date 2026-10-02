"""Scope the existing native chat UI to its current cockpit agent.

Ownership, ACLs, pagination, search and history remain Open WebUI's.
The scope is a view filter within one company's dedicated instance.
"""
from contextvars import ContextVar
from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria
from open_webui.models.chats import Chat

_agent_scope = ContextVar("hermes_chat_agent", default=None)

@event.listens_for(Session, "do_orm_execute")
def _scope_native_chat_queries(state):
    agent = _agent_scope.get()
    if agent and state.is_select and not state.is_column_load and not state.is_relationship_load:
        state.statement = state.statement.options(
            with_loader_criteria(
                Chat,
                lambda chat: chat.chat["hermesAgentId"].as_string() == agent,
                include_aliases=True,
            )
        )

class HermesChatScopeMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        agent = None
        if scope["type"] == "http" and scope.get("method") == "GET" and scope.get("path", "").startswith("/api/v1/chats"):
            headers = dict(scope.get("headers", []))
            value = headers.get(b"x-hermes-agent", b"").decode("ascii", errors="ignore")
            if value in {"sona","cto","developer","qa","devops","product","sales","marketing","researcher"}:
                agent = value
        token = _agent_scope.set(agent)
        try:
            await self.app(scope, receive, send)
        finally:
            _agent_scope.reset(token)
