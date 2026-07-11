-- Generated from immutable bjb.sql by database/scripts/generate-migrations.mjs.
-- Nine legacy primary/unique constraints; no foreign keys exist.
-- Legacy OWNER TO postgres clauses intentionally removed.
\set ON_ERROR_STOP on

BEGIN;
ALTER TABLE ONLY public.tbl_app_settings
    ADD CONSTRAINT tbl_app_settings_pk PRIMARY KEY (_id);

ALTER TABLE ONLY public.tbl_card_masters
    ADD CONSTRAINT tbl_card_masters_pk PRIMARY KEY (_id);

ALTER TABLE ONLY public.tbl_card_masters
    ADD CONSTRAINT tbl_card_masters_un UNIQUE (card_number);

ALTER TABLE ONLY public.tbl_event_details
    ADD CONSTRAINT tbl_event_details_pkey PRIMARY KEY (_id);

ALTER TABLE ONLY public.tbl_events
    ADD CONSTRAINT tbl_events_pkey PRIMARY KEY (_id);

ALTER TABLE ONLY public.tbl_role
    ADD CONSTRAINT tbl_role_pkey PRIMARY KEY (_id);

ALTER TABLE ONLY public.tbl_rooms
    ADD CONSTRAINT tbl_rooms_pkey PRIMARY KEY (_id);

ALTER TABLE ONLY public.tbl_users
    ADD CONSTRAINT tbl_users_email_key UNIQUE (email);

ALTER TABLE ONLY public.tbl_users
    ADD CONSTRAINT tbl_users_pkey PRIMARY KEY (_id);


--
-- PostgreSQL database dump complete
--

COMMIT;
