-- Generated from immutable bjb.sql by database/scripts/generate-migrations.mjs.
-- Seven legacy public tables.
-- Legacy OWNER TO postgres clauses intentionally removed.
\set ON_ERROR_STOP on

BEGIN;
CREATE TABLE public.tbl_event_details (
    _id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid,
    attendee_email character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp(6) without time zone DEFAULT now(),
    updated_at timestamp(6) without time zone,
    is_visitor boolean DEFAULT false
);

CREATE TABLE public.tbl_app_settings (
    _id uuid DEFAULT gen_random_uuid() NOT NULL,
    lock_timer integer NOT NULL,
    led_timer integer NOT NULL,
    table_input boolean NOT NULL,
    not_checked_in_time_limit integer NOT NULL,
    time_of_event_start_soon integer NOT NULL,
    available_color character varying NOT NULL,
    will_start_color character varying NOT NULL,
    on_meeting_color character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone
);

CREATE TABLE public.tbl_card_masters (
    _id uuid DEFAULT gen_random_uuid() NOT NULL,
    card_number character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp without time zone,
    updated_by uuid
);

CREATE TABLE public.tbl_events (
    _id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizer character varying,
    location character varying,
    subject character varying,
    description character varying,
    start_date timestamp(6) without time zone,
    end_date timestamp(6) without time zone,
    is_cancel boolean DEFAULT false,
    is_draft boolean DEFAULT false,
    is_allday boolean DEFAULT false,
    created_at timestamp(6) without time zone DEFAULT now(),
    updated_at timestamp(6) without time zone,
    checked_in timestamp(6) without time zone,
    late_threshold integer
);

CREATE TABLE public.tbl_role (
    _id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying,
    is_deleted boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone
);

CREATE TABLE public.tbl_rooms (
    _id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_name character varying,
    floor character varying,
    capacity integer,
    is_deleted boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp with time zone
);

CREATE TABLE public.tbl_users (
    _id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying,
    email character varying,
    password character varying,
    hashed_password character varying,
    role_id uuid,
    is_deleted boolean,
    updated_at timestamp without time zone,
    type character varying,
    floor character varying,
    capacity character varying,
    building character varying,
    feature character varying,
    created_at timestamp without time zone DEFAULT now(),
    card_number character varying
);

COMMIT;
