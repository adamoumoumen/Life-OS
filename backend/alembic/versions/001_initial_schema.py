"""initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-06-26 16:16:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pgvector extension is enabled
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Create families table
    op.create_table('families',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create users table
    op.create_table('users',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('family_id', sa.Integer(), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('parent', 'child', 'admin', name='roleenum'), nullable=False),
        sa.Column('timezone', sa.String(length=100), nullable=False),
        sa.Column('locale', sa.Enum('ar', 'fr', 'en', 'darija', name='localeenum'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['family_id'], ['families.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Create family_invites table
    op.create_table('family_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('family_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('parent', 'child', 'admin', name='roleenum'), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['family_id'], ['families.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_family_invites_email'), 'family_invites', ['email'], unique=False)
    op.create_index(op.f('ix_family_invites_token'), 'family_invites', ['token'], unique=True)
    
    # Create task_events table
    op.create_table('task_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('family_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_task', sa.Boolean(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'in_progress', 'completed', 'cancelled', name='taskstatusenum'), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('origin_timezone', sa.String(length=100), nullable=False),
        sa.Column('rrule', sa.String(length=500), nullable=True),
        sa.Column('is_movable', sa.Boolean(), nullable=False),
        sa.Column('visibility', sa.Enum('private', 'family', name='visibilityenum'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['family_id'], ['families.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_task_events_family_id'), 'task_events', ['family_id'], unique=False)
    op.create_index(op.f('ix_task_events_user_id'), 'task_events', ['user_id'], unique=False)
    
    # Create reminders table
    op.create_table('reminders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_event_id', sa.Integer(), nullable=False),
        sa.Column('channel', sa.Enum('push', 'whatsapp', name='reminderchannelenum'), nullable=False),
        sa.Column('fire_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.Enum('pending', 'sent', 'failed', 'cancelled', name='reminderstatusenum'), nullable=False),
        sa.ForeignKeyConstraint(['task_event_id'], ['task_events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reminders_fire_at'), 'reminders', ['fire_at'], unique=False)

    # Gamification
    op.create_table('gamification_profiles',
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('current_xp', sa.Integer(), nullable=False),
        sa.Column('streak_days', sa.Integer(), nullable=False),
        sa.Column('streak_freezes_available', sa.Integer(), nullable=False),
        sa.Column('last_active_date', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id')
    )
    
    op.create_table('xp_ledger',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('source_ref_id', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_xp_ledger_user_id'), 'xp_ledger', ['user_id'], unique=False)

    # Wellness logs
    op.create_table('wellness_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('sleep_minutes', sa.Integer(), nullable=True),
        sa.Column('sleep_quality', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_wellness_logs_log_date'), 'wellness_logs', ['log_date'], unique=False)
    op.create_index(op.f('ix_wellness_logs_user_id'), 'wellness_logs', ['user_id'], unique=False)

    # AI Audit & Memory
    op.create_table('agent_action_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('action_type', sa.String(length=100), nullable=False),
        sa.Column('plan_payload', sa.JSON(), nullable=False),
        sa.Column('before_state', sa.JSON(), nullable=True),
        sa.Column('status', sa.Enum('proposed', 'confirmed', 'executed', 'reverted', name='actionstatusenum'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_agent_action_logs_user_id'), 'agent_action_logs', ['user_id'], unique=False)

    op.create_table('agent_memory',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(dim=768), nullable=False),
        sa.Column('importance', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_accessed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_agent_memory_user_id'), 'agent_memory', ['user_id'], unique=False)


def downgrade() -> None:
    # Drop all tables in reverse dependency order
    op.drop_table('agent_memory')
    op.drop_table('agent_action_logs')
    op.drop_table('wellness_logs')
    op.drop_table('xp_ledger')
    op.drop_table('gamification_profiles')
    op.drop_table('reminders')
    op.drop_table('task_events')
    op.drop_table('family_invites')
    op.drop_table('users')
    op.drop_table('families')
    
    # Drop ENUM types
    sa.Enum('parent', 'child', 'admin', name='roleenum').drop(op.get_bind())
    sa.Enum('ar', 'fr', 'en', 'darija', name='localeenum').drop(op.get_bind())
    sa.Enum('private', 'family', name='visibilityenum').drop(op.get_bind())
    sa.Enum('pending', 'in_progress', 'completed', 'cancelled', name='taskstatusenum').drop(op.get_bind())
    sa.Enum('proposed', 'confirmed', 'executed', 'reverted', name='actionstatusenum').drop(op.get_bind())
    sa.Enum('push', 'whatsapp', name='reminderchannelenum').drop(op.get_bind())
    sa.Enum('pending', 'sent', 'failed', 'cancelled', name='reminderstatusenum').drop(op.get_bind())
