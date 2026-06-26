import logging
import os
from logging.config import fileConfig

from flask import current_app
from sqlalchemy import text

from alembic import context

# Alembic Config object
config = context.config

fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# ---- Scope: which Postgres schema do *we* own? ----
# Everything else in the database (public, other apps' tables, etc.) MUST be
# ignored by the autogenerator. Otherwise it'll try to drop tables that
# belong to your other projects.
TARGET_SCHEMA = os.getenv("DB_SCHEMA", "ai_skin")


def get_engine():
    try:
        # Flask-SQLAlchemy<3 / Alchemical
        return current_app.extensions['migrate'].db.get_engine()
    except (TypeError, AttributeError):
        # Flask-SQLAlchemy>=3
        return current_app.extensions['migrate'].db.engine


def get_engine_url():
    try:
        return get_engine().url.render_as_string(hide_password=False).replace(
            '%', '%%')
    except AttributeError:
        return str(get_engine().url).replace('%', '%%')


config.set_main_option('sqlalchemy.url', get_engine_url())
target_db = current_app.extensions['migrate'].db


def get_metadata():
    if hasattr(target_db, 'metadatas'):
        return target_db.metadatas[None]
    return target_db.metadata


# ---- include_object: filter so autogenerate ONLY touches our schema ----
def include_object(object_, name, type_, reflected, compare_to):
    """Return True only for objects that live in our schema.

    `reflected=True` means the object came from the DB. We want to ignore
    everything that is reflected but not in TARGET_SCHEMA, so the
    autogenerator doesn't propose dropping unrelated tables.
    """
    if type_ == "table":
        # objects reflected from the DB
        schema = getattr(object_, "schema", None)
        return schema == TARGET_SCHEMA
    if type_ == "index" or type_ == "unique_constraint" or type_ == "foreign_key_constraint":
        table = getattr(object_, "table", None)
        if table is not None:
            return getattr(table, "schema", None) == TARGET_SCHEMA
    if type_ == "column":
        table = getattr(object_, "table", None)
        if table is not None:
            return getattr(table, "schema", None) == TARGET_SCHEMA
    # schemas, sequences, etc — leave alone
    return True


def include_name(name, type_, parent_names):
    """Tell Alembic which schemas to even consider reflecting."""
    if type_ == "schema":
        return name == TARGET_SCHEMA
    return True


def _ensure_schema(connection):
    connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{TARGET_SCHEMA}"'))


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=get_metadata(),
        literal_binds=True,
        include_schemas=True,
        include_object=include_object,
        include_name=include_name,
        version_table="alembic_version",
        version_table_schema=TARGET_SCHEMA,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    conf_args = current_app.extensions['migrate'].configure_args
    if conf_args.get("process_revision_directives") is None:
        conf_args["process_revision_directives"] = process_revision_directives

    connectable = get_engine()

    with connectable.connect() as connection:
        # Make sure the schema exists before Alembic tries to put its
        # bookkeeping table (alembic_version) into it.
        _ensure_schema(connection)
        connection.commit()

        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            include_schemas=True,
            include_object=include_object,
            include_name=include_name,
            version_table="alembic_version",
            version_table_schema=TARGET_SCHEMA,
            **conf_args
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
