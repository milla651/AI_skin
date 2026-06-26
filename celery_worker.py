"""Celery worker entrypoint.

Run with:
    celery -A celery_worker.celery worker --loglevel=info --pool=solo
(use --pool=solo on Windows)
"""
from app import create_app
from app.extensions import celery

# Build the Flask app so Celery tasks have a context and the task module gets
# imported (registering @celery.task decorators).
flask_app = create_app()

# Force the task module to load
from app.tasks import analyze  # noqa: F401,E402

__all__ = ["celery", "flask_app"]
