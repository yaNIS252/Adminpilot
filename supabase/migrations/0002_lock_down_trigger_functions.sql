-- `handle_new_user` est une fonction de trigger : elle ne doit jamais être
-- appelable directement via /rest/v1/rpc. On retire l'EXECUTE accordé par
-- défaut à PUBLIC (donc à anon et authenticated) ; le trigger, lui, s'exécute
-- sous le propriétaire et n'est pas affecté.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.documents_search_vector_update() from public, anon, authenticated;
