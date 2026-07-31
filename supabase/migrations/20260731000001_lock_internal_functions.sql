-- Sprint 14 security audit, finding #1: Postgres grants EXECUTE to PUBLIC on
-- new functions by default, so the internal SECURITY DEFINER helpers were
-- callable by any signed-in user via PostgREST — including _notify, which
-- would let anyone forge notifications for anyone. Internal helpers are only
-- ever called from inside other definer functions (whose privilege context is
-- the owner) or by the service role (er-intake), so client roles lose access.
--
-- Deliberately NOT revoked: auth_role/is_admin/auth_department_id/
-- user_department (evaluated inside RLS policies as the querying user) and
-- every user-facing RPC (they enforce their own role checks internally).

revoke execute on function _notify(uuid, notification_type, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function _resequence_department_queue(uuid) from public, anon, authenticated;
revoke execute on function _close_open_session(uuid) from public, anon, authenticated;
revoke execute on function _eligible_inspector(uuid, uuid) from public, anon, authenticated;
revoke execute on function _tracking_eligible(uuid) from public, anon, authenticated;

-- er-intake (service role) legitimately calls the queue re-sequencer.
grant execute on function _resequence_department_queue(uuid) to service_role;
