docker exec -i supabase-db psql -U postgres -d postgres -A -t -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='create_certificate_with_auto_number'"
