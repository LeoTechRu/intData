--
-- PostgreSQL database dump
--

\restrict 5kM5oq5cMVFCbiWXgAtgfDDldTfTE5n3lAscUNv3VhCPSGQP7iwf5b6c1hrWA2W

-- Dumped from database version 17.6 (Debian 17.6-1.pgdg12+1)
-- Dumped by pg_dump version 17.6 (Debian 17.6-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: activitytype; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.activitytype AS ENUM (
    'work',
    'learning',
    'admin',
    'rest',
    'break_'
);


ALTER TYPE public.activitytype OWNER TO intdatadb;

--
-- Name: areatype; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.areatype AS ENUM (
    'career',
    'health',
    'education',
    'finance',
    'personal'
);


ALTER TYPE public.areatype OWNER TO intdatadb;

--
-- Name: calendaritemstatus; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.calendaritemstatus AS ENUM (
    'planned',
    'done',
    'cancelled'
);


ALTER TYPE public.calendaritemstatus OWNER TO intdatadb;

--
-- Name: channeltype; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.channeltype AS ENUM (
    'channel',
    'supergroup'
);


ALTER TYPE public.channeltype OWNER TO intdatadb;

--
-- Name: containertype; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.containertype AS ENUM (
    'project',
    'area',
    'resource'
);


ALTER TYPE public.containertype OWNER TO intdatadb;

--
-- Name: grouptype; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.grouptype AS ENUM (
    'private',
    'public',
    'group',
    'supergroup',
    'channel'
);


ALTER TYPE public.grouptype OWNER TO intdatadb;

--
-- Name: linktype; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.linktype AS ENUM (
    'hierarchy',
    'reference',
    'dependency',
    'attachment',
    'temporal',
    'metadata'
);


ALTER TYPE public.linktype OWNER TO intdatadb;

--
-- Name: loglevel; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.loglevel AS ENUM (
    'DEBUG',
    'INFO',
    'ERROR'
);


ALTER TYPE public.loglevel OWNER TO intdatadb;

--
-- Name: metrictype; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.metrictype AS ENUM (
    'count',
    'binary',
    'percent'
);


ALTER TYPE public.metrictype OWNER TO intdatadb;

--
-- Name: notificationchannelkind; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.notificationchannelkind AS ENUM (
    'telegram',
    'email'
);


ALTER TYPE public.notificationchannelkind OWNER TO intdatadb;

--
-- Name: okrstatus; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.okrstatus AS ENUM (
    'pending',
    'active',
    'completed'
);


ALTER TYPE public.okrstatus OWNER TO intdatadb;

--
-- Name: product_status; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.product_status AS ENUM (
    'pending',
    'trial',
    'paid',
    'refunded',
    'gift'
);


ALTER TYPE public.product_status OWNER TO intdatadb;

--
-- Name: projectstatus; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.projectstatus AS ENUM (
    'active',
    'paused',
    'completed'
);


ALTER TYPE public.projectstatus OWNER TO intdatadb;

--
-- Name: taskcontrolstatus; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.taskcontrolstatus AS ENUM (
    'active',
    'done',
    'dropped'
);


ALTER TYPE public.taskcontrolstatus OWNER TO intdatadb;

--
-- Name: taskrefusereason; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.taskrefusereason AS ENUM (
    'done',
    'wont_do'
);


ALTER TYPE public.taskrefusereason OWNER TO intdatadb;

--
-- Name: taskstatus; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.taskstatus AS ENUM (
    'todo',
    'in_progress',
    'done'
);


ALTER TYPE public.taskstatus OWNER TO intdatadb;

--
-- Name: taskwatcherleftreason; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.taskwatcherleftreason AS ENUM (
    'done',
    'wont_do',
    'manual'
);


ALTER TYPE public.taskwatcherleftreason OWNER TO intdatadb;

--
-- Name: taskwatcherstate; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.taskwatcherstate AS ENUM (
    'active',
    'left'
);


ALTER TYPE public.taskwatcherstate OWNER TO intdatadb;

--
-- Name: timesource; Type: TYPE; Schema: public; Owner: intdatadb
--

CREATE TYPE public.timesource AS ENUM (
    'timer',
    'manual',
    'import_'
);


ALTER TYPE public.timesource OWNER TO intdatadb;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alarms; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.alarms (
    id integer NOT NULL,
    item_id integer NOT NULL,
    trigger_at timestamp with time zone NOT NULL,
    is_sent boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    offset_sec integer,
    action text NOT NULL,
    channel_id uuid,
    payload jsonb DEFAULT '{}'::jsonb,
    enabled boolean DEFAULT true
);


ALTER TABLE public.alarms OWNER TO intdatadb;

--
-- Name: alarms_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.alarms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alarms_id_seq OWNER TO intdatadb;

--
-- Name: alarms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.alarms_id_seq OWNED BY public.alarms.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.app_settings (
    key character varying(100) NOT NULL,
    value text,
    is_secret boolean NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.app_settings OWNER TO intdatadb;

--
-- Name: archives; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.archives (
    id integer NOT NULL,
    owner_id bigint,
    source_type character varying(50),
    source_id integer,
    archived_at timestamp without time zone
);


ALTER TABLE public.archives OWNER TO intdatadb;

--
-- Name: archives_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.archives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.archives_id_seq OWNER TO intdatadb;

--
-- Name: archives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.archives_id_seq OWNED BY public.archives.id;


--
-- Name: areas; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.areas (
    id integer NOT NULL,
    owner_id bigint,
    name character varying(255) NOT NULL,
    type public.areatype,
    color character varying(7),
    context_map json,
    review_interval integer,
    review_interval_days integer,
    is_active boolean,
    archived_at timestamp with time zone,
    parent_id integer,
    mp_path character varying NOT NULL,
    depth integer NOT NULL,
    slug character varying NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    title text NOT NULL
);


ALTER TABLE public.areas OWNER TO intdatadb;

--
-- Name: areas_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.areas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.areas_id_seq OWNER TO intdatadb;

--
-- Name: areas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.areas_id_seq OWNED BY public.areas.id;


--
-- Name: auth_audit_entries; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.auth_audit_entries (
    id integer NOT NULL,
    actor_user_id integer,
    target_user_id integer NOT NULL,
    action text NOT NULL,
    role_slug text,
    scope_type text DEFAULT 'global'::text NOT NULL,
    scope_id integer,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_auth_audit_scope CHECK ((scope_type = ANY (ARRAY['global'::text, 'area'::text, 'project'::text])))
);


ALTER TABLE public.auth_audit_entries OWNER TO intdatadb;

--
-- Name: auth_audit_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.auth_audit_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auth_audit_entries_id_seq OWNER TO intdatadb;

--
-- Name: auth_audit_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.auth_audit_entries_id_seq OWNED BY public.auth_audit_entries.id;


--
-- Name: auth_permissions; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.auth_permissions (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(255),
    code text NOT NULL,
    bit_position smallint NOT NULL,
    category text,
    mutable boolean DEFAULT true NOT NULL
);


ALTER TABLE public.auth_permissions OWNER TO intdatadb;

--
-- Name: auth_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.auth_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auth_permissions_id_seq OWNER TO intdatadb;

--
-- Name: auth_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.auth_permissions_id_seq OWNED BY public.auth_permissions.id;


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.calendar_events (
    id integer NOT NULL,
    owner_id bigint,
    title character varying(255) NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    description character varying(500),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.calendar_events OWNER TO intdatadb;

--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_events_id_seq OWNER TO intdatadb;

--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- Name: calendar_items; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.calendar_items (
    id integer NOT NULL,
    owner_id bigint,
    title character varying(255) NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    project_id integer,
    area_id integer,
    status public.calendaritemstatus,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    kind text NOT NULL,
    notes text,
    tzid text DEFAULT 'UTC'::text,
    due_at timestamp with time zone,
    rrule text,
    priority integer,
    meta jsonb DEFAULT '{}'::jsonb,
    created_by uuid
);


ALTER TABLE public.calendar_items OWNER TO intdatadb;

--
-- Name: calendar_items_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.calendar_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calendar_items_id_seq OWNER TO intdatadb;

--
-- Name: calendar_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.calendar_items_id_seq OWNED BY public.calendar_items.id;


--
-- Name: channels; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.channels (
    id bigint NOT NULL,
    telegram_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    type public.channeltype NOT NULL,
    owner_id bigint,
    username character varying(32),
    participants_count integer,
    description character varying(500),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    address jsonb NOT NULL
);


ALTER TABLE public.channels OWNER TO intdatadb;

--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.channels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.channels_id_seq OWNER TO intdatadb;

--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: dailies; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.dailies (
    id bigint NOT NULL,
    owner_id bigint,
    area_id integer NOT NULL,
    project_id integer,
    title text NOT NULL,
    note text,
    rrule text NOT NULL,
    difficulty text NOT NULL,
    streak integer DEFAULT 0 NOT NULL,
    frozen boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dailies_difficulty_check CHECK ((difficulty = ANY (ARRAY['trivial'::text, 'easy'::text, 'medium'::text, 'hard'::text])))
);


ALTER TABLE public.dailies OWNER TO intdatadb;

--
-- Name: dailies_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.dailies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dailies_id_seq OWNER TO intdatadb;

--
-- Name: dailies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.dailies_id_seq OWNED BY public.dailies.id;


--
-- Name: daily_logs; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.daily_logs (
    id bigint NOT NULL,
    daily_id bigint,
    owner_id bigint,
    date date NOT NULL,
    done boolean NOT NULL,
    reward_xp integer,
    reward_gold integer,
    penalty_hp integer
);


ALTER TABLE public.daily_logs OWNER TO intdatadb;

--
-- Name: daily_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.daily_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_logs_id_seq OWNER TO intdatadb;

--
-- Name: daily_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.daily_logs_id_seq OWNED BY public.daily_logs.id;


--
-- Name: diagnostic_clients; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.diagnostic_clients (
    id integer NOT NULL,
    user_id integer NOT NULL,
    specialist_id integer,
    is_new boolean DEFAULT true NOT NULL,
    in_archive boolean DEFAULT false NOT NULL,
    contact_permission boolean DEFAULT true NOT NULL,
    last_result_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.diagnostic_clients OWNER TO intdatadb;

--
-- Name: diagnostic_clients_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.diagnostic_clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diagnostic_clients_id_seq OWNER TO intdatadb;

--
-- Name: diagnostic_clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.diagnostic_clients_id_seq OWNED BY public.diagnostic_clients.id;


--
-- Name: diagnostic_results; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.diagnostic_results (
    id bigint NOT NULL,
    client_id integer NOT NULL,
    specialist_id integer,
    diagnostic_id smallint,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    open_answer text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.diagnostic_results OWNER TO intdatadb;

--
-- Name: diagnostic_results_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.diagnostic_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diagnostic_results_id_seq OWNER TO intdatadb;

--
-- Name: diagnostic_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.diagnostic_results_id_seq OWNED BY public.diagnostic_results.id;


--
-- Name: diagnostic_templates; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.diagnostic_templates (
    id smallint NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    form_path text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.diagnostic_templates OWNER TO intdatadb;

--
-- Name: entity_profile_grants; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.entity_profile_grants (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    audience_type text NOT NULL,
    subject_id bigint,
    sections jsonb,
    created_by integer,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_profile_grants_audience CHECK ((audience_type = ANY (ARRAY['public'::text, 'authenticated'::text, 'user'::text, 'group'::text, 'project'::text, 'area'::text]))),
    CONSTRAINT ck_profile_grants_sections CHECK (((sections IS NULL) OR (jsonb_typeof(sections) = 'array'::text))),
    CONSTRAINT ck_profile_grants_subject CHECK ((((audience_type = ANY (ARRAY['public'::text, 'authenticated'::text])) AND (subject_id IS NULL)) OR ((audience_type <> ALL (ARRAY['public'::text, 'authenticated'::text])) AND (subject_id IS NOT NULL))))
);


ALTER TABLE public.entity_profile_grants OWNER TO intdatadb;

--
-- Name: entity_profile_grants_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.entity_profile_grants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_profile_grants_id_seq OWNER TO intdatadb;

--
-- Name: entity_profile_grants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.entity_profile_grants_id_seq OWNED BY public.entity_profile_grants.id;


--
-- Name: entity_profiles; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.entity_profiles (
    id integer NOT NULL,
    entity_type text NOT NULL,
    entity_id bigint NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    headline text,
    summary text,
    avatar_url text,
    cover_url text,
    tags jsonb DEFAULT '[]'::jsonb,
    profile_meta jsonb DEFAULT '{}'::jsonb,
    sections jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_entity_profiles_meta CHECK (((profile_meta IS NULL) OR (jsonb_typeof(profile_meta) = 'object'::text))),
    CONSTRAINT ck_entity_profiles_sections CHECK (((sections IS NULL) OR (jsonb_typeof(sections) = 'array'::text))),
    CONSTRAINT ck_entity_profiles_slug CHECK (((char_length(slug) >= 1) AND (char_length(slug) <= 255))),
    CONSTRAINT ck_entity_profiles_tags CHECK (((tags IS NULL) OR (jsonb_typeof(tags) = 'array'::text))),
    CONSTRAINT ck_entity_profiles_type CHECK ((entity_type = ANY (ARRAY['user'::text, 'group'::text, 'project'::text, 'area'::text])))
);


ALTER TABLE public.entity_profiles OWNER TO intdatadb;

--
-- Name: entity_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.entity_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entity_profiles_id_seq OWNER TO intdatadb;

--
-- Name: entity_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.entity_profiles_id_seq OWNED BY public.entity_profiles.id;


--
-- Name: gcal_links; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.gcal_links (
    id integer NOT NULL,
    owner_id bigint,
    calendar_id character varying(255) NOT NULL,
    access_token character varying(255) NOT NULL,
    refresh_token character varying(255) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    user_id uuid NOT NULL,
    google_calendar_id text NOT NULL,
    scope text NOT NULL,
    token_expiry timestamp with time zone NOT NULL,
    sync_token text,
    resource_id text,
    channel_id text,
    channel_expiry timestamp with time zone
);


ALTER TABLE public.gcal_links OWNER TO intdatadb;

--
-- Name: gcal_links_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.gcal_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gcal_links_id_seq OWNER TO intdatadb;

--
-- Name: gcal_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.gcal_links_id_seq OWNED BY public.gcal_links.id;


--
-- Name: group_activity_daily; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.group_activity_daily (
    group_id bigint NOT NULL,
    user_id bigint NOT NULL,
    activity_date date NOT NULL,
    messages_count integer DEFAULT 0 NOT NULL,
    reactions_count integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.group_activity_daily OWNER TO intdatadb;

--
-- Name: group_removal_log; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.group_removal_log (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    user_id bigint NOT NULL,
    product_id integer,
    initiator_web_id integer,
    initiator_tg_id bigint,
    reason text,
    result character varying(32) DEFAULT 'queued'::character varying NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.group_removal_log OWNER TO intdatadb;

--
-- Name: group_removal_log_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.group_removal_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_removal_log_id_seq OWNER TO intdatadb;

--
-- Name: group_removal_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.group_removal_log_id_seq OWNED BY public.group_removal_log.id;


--
-- Name: groups; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.groups (
    id bigint NOT NULL,
    telegram_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    type public.grouptype,
    owner_id bigint,
    description character varying(500),
    participants_count integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.groups OWNER TO intdatadb;

--
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.groups_id_seq OWNER TO intdatadb;

--
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- Name: habit_logs; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.habit_logs (
    id bigint NOT NULL,
    habit_id bigint,
    owner_id bigint,
    at timestamp with time zone DEFAULT now() NOT NULL,
    delta integer NOT NULL,
    reward_xp integer,
    reward_gold integer,
    penalty_hp integer,
    val_after double precision,
    CONSTRAINT habit_logs_delta_check CHECK ((delta = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE public.habit_logs OWNER TO intdatadb;

--
-- Name: habit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.habit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.habit_logs_id_seq OWNER TO intdatadb;

--
-- Name: habit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.habit_logs_id_seq OWNED BY public.habit_logs.id;


--
-- Name: habits; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.habits (
    id integer NOT NULL,
    owner_id bigint,
    name character varying(255) NOT NULL,
    description character varying(500),
    schedule json,
    metrics json,
    frequency character varying(20),
    progress json,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    area_id integer NOT NULL,
    project_id integer,
    title text,
    note text,
    type text,
    difficulty text,
    up_enabled boolean DEFAULT true NOT NULL,
    down_enabled boolean DEFAULT true NOT NULL,
    val double precision DEFAULT 0 NOT NULL,
    tags text[],
    archived_at timestamp with time zone,
    daily_limit integer DEFAULT 10 NOT NULL,
    cooldown_sec integer DEFAULT 60 NOT NULL,
    last_action_at timestamp with time zone,
    CONSTRAINT habits_difficulty_check CHECK ((difficulty = ANY (ARRAY['trivial'::text, 'easy'::text, 'medium'::text, 'hard'::text]))),
    CONSTRAINT habits_type_check CHECK ((type = ANY (ARRAY['positive'::text, 'negative'::text, 'both'::text])))
);


ALTER TABLE public.habits OWNER TO intdatadb;

--
-- Name: habits_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.habits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.habits_id_seq OWNER TO intdatadb;

--
-- Name: habits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.habits_id_seq OWNED BY public.habits.id;


--
-- Name: interfaces; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.interfaces (
    id integer NOT NULL,
    owner_id bigint,
    name character varying(255) NOT NULL,
    config json,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.interfaces OWNER TO intdatadb;

--
-- Name: interfaces_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.interfaces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.interfaces_id_seq OWNER TO intdatadb;

--
-- Name: interfaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.interfaces_id_seq OWNED BY public.interfaces.id;


--
-- Name: key_results; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.key_results (
    id integer NOT NULL,
    okr_id integer,
    description character varying(255) NOT NULL,
    metric_type public.metrictype,
    weight double precision,
    target_value double precision,
    current_value double precision,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.key_results OWNER TO intdatadb;

--
-- Name: key_results_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.key_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.key_results_id_seq OWNER TO intdatadb;

--
-- Name: key_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.key_results_id_seq OWNED BY public.key_results.id;


--
-- Name: limits; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.limits (
    id integer NOT NULL,
    owner_id bigint,
    resource character varying(50) NOT NULL,
    value integer NOT NULL,
    expires_at timestamp without time zone
);


ALTER TABLE public.limits OWNER TO intdatadb;

--
-- Name: limits_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.limits_id_seq OWNER TO intdatadb;

--
-- Name: limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.limits_id_seq OWNED BY public.limits.id;


--
-- Name: links; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.links (
    id integer NOT NULL,
    source_type character varying(50),
    source_id integer,
    target_type character varying(50),
    target_id integer,
    link_type public.linktype,
    weight double precision,
    decay double precision,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.links OWNER TO intdatadb;

--
-- Name: links_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.links_id_seq OWNER TO intdatadb;

--
-- Name: links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.links_id_seq OWNED BY public.links.id;


--
-- Name: log_settings; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.log_settings (
    id bigint NOT NULL,
    chat_id bigint NOT NULL,
    level public.loglevel,
    updated_at timestamp with time zone
);


ALTER TABLE public.log_settings OWNER TO intdatadb;

--
-- Name: log_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.log_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.log_settings_id_seq OWNER TO intdatadb;

--
-- Name: log_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.log_settings_id_seq OWNED BY public.log_settings.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    owner_id bigint,
    title text,
    content text NOT NULL,
    container_type public.containertype,
    container_id integer,
    archived_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    area_id bigint,
    project_id bigint,
    color character varying(20),
    pinned boolean DEFAULT false,
    order_index integer DEFAULT 0
);


ALTER TABLE public.notes OWNER TO intdatadb;

--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notes_id_seq OWNER TO intdatadb;

--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: notification_channels; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.notification_channels (
    id integer NOT NULL,
    owner_id bigint,
    kind public.notificationchannelkind NOT NULL,
    address json NOT NULL,
    is_active boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.notification_channels OWNER TO intdatadb;

--
-- Name: notification_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.notification_channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_channels_id_seq OWNER TO intdatadb;

--
-- Name: notification_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.notification_channels_id_seq OWNED BY public.notification_channels.id;


--
-- Name: notification_triggers; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.notification_triggers (
    id integer NOT NULL,
    next_fire_at timestamp with time zone NOT NULL,
    alarm_id integer,
    rule json,
    dedupe_key character varying(255) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.notification_triggers OWNER TO intdatadb;

--
-- Name: notification_triggers_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.notification_triggers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_triggers_id_seq OWNER TO intdatadb;

--
-- Name: notification_triggers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.notification_triggers_id_seq OWNED BY public.notification_triggers.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    dedupe_key character varying(255) NOT NULL,
    sent_at timestamp with time zone
);


ALTER TABLE public.notifications OWNER TO intdatadb;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO intdatadb;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: okrs; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.okrs (
    id integer NOT NULL,
    owner_id bigint,
    objective character varying(255) NOT NULL,
    description character varying(500),
    status public.okrstatus,
    period_start date,
    period_end date,
    confidence integer,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.okrs OWNER TO intdatadb;

--
-- Name: okrs_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.okrs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.okrs_id_seq OWNER TO intdatadb;

--
-- Name: okrs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.okrs_id_seq OWNED BY public.okrs.id;


--
-- Name: para_overrides; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.para_overrides (
    id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    override_project_id uuid,
    override_area_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.para_overrides OWNER TO intdatadb;

--
-- Name: products; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.products (
    id integer NOT NULL,
    slug character varying(64) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    active boolean DEFAULT true NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO intdatadb;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO intdatadb;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: project_notifications; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.project_notifications (
    id integer NOT NULL,
    project_id integer NOT NULL,
    channel_id integer NOT NULL,
    rules json NOT NULL,
    is_enabled boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.project_notifications OWNER TO intdatadb;

--
-- Name: project_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.project_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.project_notifications_id_seq OWNER TO intdatadb;

--
-- Name: project_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.project_notifications_id_seq OWNED BY public.project_notifications.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    area_id integer NOT NULL,
    owner_id bigint,
    name character varying(255) NOT NULL,
    description character varying(500),
    cognitive_cost integer,
    neural_priority double precision,
    schedule json,
    metrics json,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    status public.projectstatus,
    slug character varying(255),
    archived_at timestamp with time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    title text NOT NULL
);


ALTER TABLE public.projects OWNER TO intdatadb;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_id_seq OWNER TO intdatadb;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.reminders (
    id integer NOT NULL,
    owner_id bigint,
    task_id integer,
    message character varying(500) NOT NULL,
    remind_at timestamp with time zone NOT NULL,
    is_done boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.reminders OWNER TO intdatadb;

--
-- Name: reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reminders_id_seq OWNER TO intdatadb;

--
-- Name: reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.reminders_id_seq OWNED BY public.reminders.id;


--
-- Name: resources; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.resources (
    id integer NOT NULL,
    owner_id bigint,
    title character varying(255) NOT NULL,
    content character varying(2000),
    type character varying(50),
    meta json,
    archived_at timestamp with time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    project_id uuid,
    area_id uuid,
    human_user_id uuid
);


ALTER TABLE public.resources OWNER TO intdatadb;

--
-- Name: resources_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.resources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resources_id_seq OWNER TO intdatadb;

--
-- Name: resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.resources_id_seq OWNED BY public.resources.id;


--
-- Name: rewards; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.rewards (
    id bigint NOT NULL,
    owner_id bigint,
    title text NOT NULL,
    cost_gold integer NOT NULL,
    area_id integer NOT NULL,
    project_id integer,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rewards_cost_gold_check CHECK ((cost_gold >= 0))
);


ALTER TABLE public.rewards OWNER TO intdatadb;

--
-- Name: rewards_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.rewards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rewards_id_seq OWNER TO intdatadb;

--
-- Name: rewards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.rewards_id_seq OWNED BY public.rewards.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    level integer,
    description character varying(255),
    slug text NOT NULL,
    permissions_mask bigint DEFAULT 0 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    grants_all boolean DEFAULT false NOT NULL
);


ALTER TABLE public.roles OWNER TO intdatadb;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO intdatadb;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: schedule_exceptions; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.schedule_exceptions (
    id integer NOT NULL,
    task_id integer,
    date date,
    reason character varying(255)
);


ALTER TABLE public.schedule_exceptions OWNER TO intdatadb;

--
-- Name: schedule_exceptions_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.schedule_exceptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schedule_exceptions_id_seq OWNER TO intdatadb;

--
-- Name: schedule_exceptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.schedule_exceptions_id_seq OWNED BY public.schedule_exceptions.id;


--
-- Name: task_checkpoints; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.task_checkpoints (
    id integer NOT NULL,
    task_id integer,
    name character varying(255),
    completed boolean,
    completed_at timestamp without time zone
);


ALTER TABLE public.task_checkpoints OWNER TO intdatadb;

--
-- Name: task_checkpoints_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.task_checkpoints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_checkpoints_id_seq OWNER TO intdatadb;

--
-- Name: task_checkpoints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.task_checkpoints_id_seq OWNED BY public.task_checkpoints.id;


--
-- Name: task_reminders; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.task_reminders (
    id integer NOT NULL,
    task_id integer NOT NULL,
    owner_id bigint NOT NULL,
    kind text DEFAULT 'custom'::text NOT NULL,
    trigger_at timestamp with time zone NOT NULL,
    frequency_minutes integer,
    is_active boolean DEFAULT true NOT NULL,
    last_triggered_at timestamp with time zone,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_reminders OWNER TO intdatadb;

--
-- Name: task_reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.task_reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_reminders_id_seq OWNER TO intdatadb;

--
-- Name: task_reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.task_reminders_id_seq OWNED BY public.task_reminders.id;


--
-- Name: task_watchers; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.task_watchers (
    id integer NOT NULL,
    task_id integer NOT NULL,
    watcher_id bigint NOT NULL,
    added_by bigint,
    state public.taskwatcherstate DEFAULT 'active'::public.taskwatcherstate NOT NULL,
    left_reason public.taskwatcherleftreason,
    left_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_watchers OWNER TO intdatadb;

--
-- Name: task_watchers_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.task_watchers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.task_watchers_id_seq OWNER TO intdatadb;

--
-- Name: task_watchers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.task_watchers_id_seq OWNED BY public.task_watchers.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    owner_id bigint,
    title character varying(255) NOT NULL,
    description character varying(500),
    due_date timestamp with time zone,
    status public.taskstatus,
    cognitive_cost integer,
    neural_priority double precision,
    repeat_config json,
    recurrence character varying(50),
    excluded_dates json,
    custom_properties json,
    schedule_type character varying(50),
    reschedule_count integer,
    project_id integer,
    area_id integer,
    estimate_minutes integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    control_enabled boolean DEFAULT false NOT NULL,
    control_frequency integer,
    control_status public.taskcontrolstatus DEFAULT 'active'::public.taskcontrolstatus NOT NULL,
    control_next_at timestamp with time zone,
    refused_reason public.taskrefusereason,
    remind_policy jsonb DEFAULT '{}'::jsonb,
    is_watched boolean DEFAULT false NOT NULL
);


ALTER TABLE public.tasks OWNER TO intdatadb;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO intdatadb;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.time_entries (
    id integer NOT NULL,
    owner_id bigint,
    task_id integer,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    description character varying(500),
    project_id integer,
    area_id integer,
    activity_type public.activitytype,
    billable boolean,
    source public.timesource,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.time_entries OWNER TO intdatadb;

--
-- Name: time_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.time_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.time_entries_id_seq OWNER TO intdatadb;

--
-- Name: time_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.time_entries_id_seq OWNED BY public.time_entries.id;


--
-- Name: user_group; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.user_group (
    user_id bigint NOT NULL,
    group_id bigint NOT NULL,
    is_owner boolean,
    is_moderator boolean,
    joined_at timestamp with time zone,
    crm_notes text,
    trial_expires_at timestamp with time zone,
    crm_tags jsonb DEFAULT '[]'::jsonb,
    crm_metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.user_group OWNER TO intdatadb;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id integer,
    role_id integer,
    expires_at timestamp without time zone,
    scope_type text NOT NULL,
    scope_id integer,
    granted_by integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ck_user_roles_scope CHECK ((scope_type = ANY (ARRAY['global'::text, 'area'::text, 'project'::text])))
);


ALTER TABLE public.user_roles OWNER TO intdatadb;

--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_roles_id_seq OWNER TO intdatadb;

--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.user_settings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    key character varying(64) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_settings OWNER TO intdatadb;

--
-- Name: user_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.user_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_settings_id_seq OWNER TO intdatadb;

--
-- Name: user_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.user_settings_id_seq OWNED BY public.user_settings.id;


--
-- Name: user_stats; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.user_stats (
    owner_id bigint NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    gold integer DEFAULT 0 NOT NULL,
    hp integer DEFAULT 50 NOT NULL,
    kp bigint DEFAULT 0 NOT NULL,
    last_cron date,
    daily_xp integer DEFAULT 0 NOT NULL,
    daily_gold integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.user_stats OWNER TO intdatadb;

--
-- Name: users_products; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.users_products (
    user_id bigint NOT NULL,
    product_id integer NOT NULL,
    status public.product_status DEFAULT 'paid'::public.product_status NOT NULL,
    source character varying(64),
    acquired_at timestamp with time zone DEFAULT now(),
    notes text,
    extra jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users_products OWNER TO intdatadb;

--
-- Name: users_tg; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.users_tg (
    id integer NOT NULL,
    telegram_id bigint NOT NULL,
    username character varying(32),
    first_name character varying(255),
    last_name character varying(255),
    language_code character varying(10),
    role character varying(20),
    bot_settings json,
    ics_token_hash character varying(64),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.users_tg OWNER TO intdatadb;

--
-- Name: users_tg_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.users_tg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_tg_id_seq OWNER TO intdatadb;

--
-- Name: users_tg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.users_tg_id_seq OWNED BY public.users_tg.id;


--
-- Name: users_web; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.users_web (
    id integer NOT NULL,
    username character varying(64) NOT NULL,
    email character varying(255),
    phone character varying(20),
    full_name character varying(255),
    password_hash character varying(255),
    role character varying(20),
    privacy_settings json,
    birthday date,
    language character varying(10),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    diagnostics_enabled boolean DEFAULT false NOT NULL,
    diagnostics_active boolean DEFAULT true NOT NULL,
    diagnostics_available smallint[] DEFAULT '{}'::smallint[] NOT NULL
);


ALTER TABLE public.users_web OWNER TO intdatadb;

--
-- Name: users_web_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.users_web_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_web_id_seq OWNER TO intdatadb;

--
-- Name: users_web_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.users_web_id_seq OWNED BY public.users_web.id;


--
-- Name: users_web_tg; Type: TABLE; Schema: public; Owner: intdatadb
--

CREATE TABLE public.users_web_tg (
    id integer NOT NULL,
    web_user_id integer NOT NULL,
    tg_user_id integer NOT NULL,
    link_type character varying(50),
    created_at timestamp with time zone
);


ALTER TABLE public.users_web_tg OWNER TO intdatadb;

--
-- Name: users_web_tg_id_seq; Type: SEQUENCE; Schema: public; Owner: intdatadb
--

CREATE SEQUENCE public.users_web_tg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_web_tg_id_seq OWNER TO intdatadb;

--
-- Name: users_web_tg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: intdatadb
--

ALTER SEQUENCE public.users_web_tg_id_seq OWNED BY public.users_web_tg.id;


--
-- Name: alarms id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.alarms ALTER COLUMN id SET DEFAULT nextval('public.alarms_id_seq'::regclass);


--
-- Name: archives id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.archives ALTER COLUMN id SET DEFAULT nextval('public.archives_id_seq'::regclass);


--
-- Name: areas id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.areas ALTER COLUMN id SET DEFAULT nextval('public.areas_id_seq'::regclass);


--
-- Name: auth_audit_entries id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.auth_audit_entries ALTER COLUMN id SET DEFAULT nextval('public.auth_audit_entries_id_seq'::regclass);


--
-- Name: auth_permissions id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.auth_permissions ALTER COLUMN id SET DEFAULT nextval('public.auth_permissions_id_seq'::regclass);


--
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- Name: calendar_items id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_items ALTER COLUMN id SET DEFAULT nextval('public.calendar_items_id_seq'::regclass);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: dailies id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.dailies ALTER COLUMN id SET DEFAULT nextval('public.dailies_id_seq'::regclass);


--
-- Name: daily_logs id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.daily_logs ALTER COLUMN id SET DEFAULT nextval('public.daily_logs_id_seq'::regclass);


--
-- Name: diagnostic_clients id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_clients ALTER COLUMN id SET DEFAULT nextval('public.diagnostic_clients_id_seq'::regclass);


--
-- Name: diagnostic_results id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_results ALTER COLUMN id SET DEFAULT nextval('public.diagnostic_results_id_seq'::regclass);


--
-- Name: entity_profile_grants id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.entity_profile_grants ALTER COLUMN id SET DEFAULT nextval('public.entity_profile_grants_id_seq'::regclass);


--
-- Name: entity_profiles id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.entity_profiles ALTER COLUMN id SET DEFAULT nextval('public.entity_profiles_id_seq'::regclass);


--
-- Name: gcal_links id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.gcal_links ALTER COLUMN id SET DEFAULT nextval('public.gcal_links_id_seq'::regclass);


--
-- Name: group_removal_log id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_removal_log ALTER COLUMN id SET DEFAULT nextval('public.group_removal_log_id_seq'::regclass);


--
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- Name: habit_logs id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.habit_logs ALTER COLUMN id SET DEFAULT nextval('public.habit_logs_id_seq'::regclass);


--
-- Name: habits id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.habits ALTER COLUMN id SET DEFAULT nextval('public.habits_id_seq'::regclass);


--
-- Name: interfaces id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.interfaces ALTER COLUMN id SET DEFAULT nextval('public.interfaces_id_seq'::regclass);


--
-- Name: key_results id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.key_results ALTER COLUMN id SET DEFAULT nextval('public.key_results_id_seq'::regclass);


--
-- Name: limits id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.limits ALTER COLUMN id SET DEFAULT nextval('public.limits_id_seq'::regclass);


--
-- Name: links id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.links ALTER COLUMN id SET DEFAULT nextval('public.links_id_seq'::regclass);


--
-- Name: log_settings id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.log_settings ALTER COLUMN id SET DEFAULT nextval('public.log_settings_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: notification_channels id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notification_channels ALTER COLUMN id SET DEFAULT nextval('public.notification_channels_id_seq'::regclass);


--
-- Name: notification_triggers id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notification_triggers ALTER COLUMN id SET DEFAULT nextval('public.notification_triggers_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: okrs id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.okrs ALTER COLUMN id SET DEFAULT nextval('public.okrs_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: project_notifications id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.project_notifications ALTER COLUMN id SET DEFAULT nextval('public.project_notifications_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: reminders id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.reminders ALTER COLUMN id SET DEFAULT nextval('public.reminders_id_seq'::regclass);


--
-- Name: resources id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.resources ALTER COLUMN id SET DEFAULT nextval('public.resources_id_seq'::regclass);


--
-- Name: rewards id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.rewards ALTER COLUMN id SET DEFAULT nextval('public.rewards_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: schedule_exceptions id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.schedule_exceptions ALTER COLUMN id SET DEFAULT nextval('public.schedule_exceptions_id_seq'::regclass);


--
-- Name: task_checkpoints id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_checkpoints ALTER COLUMN id SET DEFAULT nextval('public.task_checkpoints_id_seq'::regclass);


--
-- Name: task_reminders id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_reminders ALTER COLUMN id SET DEFAULT nextval('public.task_reminders_id_seq'::regclass);


--
-- Name: task_watchers id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_watchers ALTER COLUMN id SET DEFAULT nextval('public.task_watchers_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: time_entries id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.time_entries ALTER COLUMN id SET DEFAULT nextval('public.time_entries_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: user_settings id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_settings ALTER COLUMN id SET DEFAULT nextval('public.user_settings_id_seq'::regclass);


--
-- Name: users_tg id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_tg ALTER COLUMN id SET DEFAULT nextval('public.users_tg_id_seq'::regclass);


--
-- Name: users_web id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web ALTER COLUMN id SET DEFAULT nextval('public.users_web_id_seq'::regclass);


--
-- Name: users_web_tg id; Type: DEFAULT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web_tg ALTER COLUMN id SET DEFAULT nextval('public.users_web_tg_id_seq'::regclass);


--
-- Name: alarms alarms_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.alarms
    ADD CONSTRAINT alarms_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: archives archives_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.archives
    ADD CONSTRAINT archives_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: auth_audit_entries auth_audit_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.auth_audit_entries
    ADD CONSTRAINT auth_audit_entries_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: calendar_items calendar_items_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_items
    ADD CONSTRAINT calendar_items_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: channels channels_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_telegram_id_key UNIQUE (telegram_id);


--
-- Name: dailies dailies_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.dailies
    ADD CONSTRAINT dailies_pkey PRIMARY KEY (id);


--
-- Name: daily_logs daily_logs_daily_id_date_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.daily_logs
    ADD CONSTRAINT daily_logs_daily_id_date_key UNIQUE (daily_id, date);


--
-- Name: daily_logs daily_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.daily_logs
    ADD CONSTRAINT daily_logs_pkey PRIMARY KEY (id);


--
-- Name: diagnostic_clients diagnostic_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_clients
    ADD CONSTRAINT diagnostic_clients_pkey PRIMARY KEY (id);


--
-- Name: diagnostic_clients diagnostic_clients_user_id_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_clients
    ADD CONSTRAINT diagnostic_clients_user_id_key UNIQUE (user_id);


--
-- Name: diagnostic_results diagnostic_results_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_results
    ADD CONSTRAINT diagnostic_results_pkey PRIMARY KEY (id);


--
-- Name: diagnostic_templates diagnostic_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_templates
    ADD CONSTRAINT diagnostic_templates_pkey PRIMARY KEY (id);


--
-- Name: diagnostic_templates diagnostic_templates_slug_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_templates
    ADD CONSTRAINT diagnostic_templates_slug_key UNIQUE (slug);


--
-- Name: entity_profile_grants entity_profile_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.entity_profile_grants
    ADD CONSTRAINT entity_profile_grants_pkey PRIMARY KEY (id);


--
-- Name: entity_profiles entity_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.entity_profiles
    ADD CONSTRAINT entity_profiles_pkey PRIMARY KEY (id);


--
-- Name: gcal_links gcal_links_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.gcal_links
    ADD CONSTRAINT gcal_links_pkey PRIMARY KEY (id);


--
-- Name: group_activity_daily group_activity_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_activity_daily
    ADD CONSTRAINT group_activity_daily_pkey PRIMARY KEY (group_id, user_id, activity_date);


--
-- Name: group_removal_log group_removal_log_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_removal_log
    ADD CONSTRAINT group_removal_log_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: groups groups_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_telegram_id_key UNIQUE (telegram_id);


--
-- Name: habit_logs habit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.habit_logs
    ADD CONSTRAINT habit_logs_pkey PRIMARY KEY (id);


--
-- Name: habits habits_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_pkey PRIMARY KEY (id);


--
-- Name: interfaces interfaces_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.interfaces
    ADD CONSTRAINT interfaces_pkey PRIMARY KEY (id);


--
-- Name: key_results key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.key_results
    ADD CONSTRAINT key_results_pkey PRIMARY KEY (id);


--
-- Name: limits limits_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.limits
    ADD CONSTRAINT limits_pkey PRIMARY KEY (id);


--
-- Name: links links_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_pkey PRIMARY KEY (id);


--
-- Name: log_settings log_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.log_settings
    ADD CONSTRAINT log_settings_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notification_channels notification_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notification_channels
    ADD CONSTRAINT notification_channels_pkey PRIMARY KEY (id);


--
-- Name: notification_triggers notification_triggers_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notification_triggers
    ADD CONSTRAINT notification_triggers_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: notification_triggers notification_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notification_triggers
    ADD CONSTRAINT notification_triggers_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: okrs okrs_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.okrs
    ADD CONSTRAINT okrs_pkey PRIMARY KEY (id);


--
-- Name: para_overrides para_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.para_overrides
    ADD CONSTRAINT para_overrides_pkey PRIMARY KEY (id);


--
-- Name: auth_permissions perms_name_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.auth_permissions
    ADD CONSTRAINT perms_name_key UNIQUE (name);


--
-- Name: auth_permissions perms_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.auth_permissions
    ADD CONSTRAINT perms_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: project_notifications project_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.project_notifications
    ADD CONSTRAINT project_notifications_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: rewards rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schedule_exceptions schedule_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_pkey PRIMARY KEY (id);


--
-- Name: task_checkpoints task_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_checkpoints
    ADD CONSTRAINT task_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: task_reminders task_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_reminders
    ADD CONSTRAINT task_reminders_pkey PRIMARY KEY (id);


--
-- Name: task_watchers task_watchers_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_watchers
    ADD CONSTRAINT task_watchers_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: user_roles uq_user_roles_assignment; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT uq_user_roles_assignment UNIQUE (user_id, role_id, scope_type, scope_id);


--
-- Name: user_group user_group_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_group
    ADD CONSTRAINT user_group_pkey PRIMARY KEY (user_id, group_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_key_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_key_key UNIQUE (user_id, key);


--
-- Name: user_stats user_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_pkey PRIMARY KEY (owner_id);


--
-- Name: users_products users_products_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_products
    ADD CONSTRAINT users_products_pkey PRIMARY KEY (user_id, product_id);


--
-- Name: users_tg users_tg_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_tg
    ADD CONSTRAINT users_tg_pkey PRIMARY KEY (id);


--
-- Name: users_tg users_tg_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_tg
    ADD CONSTRAINT users_tg_telegram_id_key UNIQUE (telegram_id);


--
-- Name: users_tg users_tg_username_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_tg
    ADD CONSTRAINT users_tg_username_key UNIQUE (username);


--
-- Name: users_web users_web_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web
    ADD CONSTRAINT users_web_pkey PRIMARY KEY (id);


--
-- Name: users_web_tg users_web_tg_pkey; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web_tg
    ADD CONSTRAINT users_web_tg_pkey PRIMARY KEY (id);


--
-- Name: users_web_tg users_web_tg_tg_user_id_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web_tg
    ADD CONSTRAINT users_web_tg_tg_user_id_key UNIQUE (tg_user_id);


--
-- Name: users_web users_web_username_key; Type: CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web
    ADD CONSTRAINT users_web_username_key UNIQUE (username);


--
-- Name: habit_logs_owner_at_idx; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX habit_logs_owner_at_idx ON public.habit_logs USING btree (owner_id, at);


--
-- Name: idx_alarms_item_id; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_alarms_item_id ON public.alarms USING btree (item_id);


--
-- Name: idx_alarms_trigger_at; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_alarms_trigger_at ON public.alarms USING btree (trigger_at);


--
-- Name: idx_calendar_items_area_id; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_calendar_items_area_id ON public.calendar_items USING btree (area_id);


--
-- Name: idx_calendar_items_due_at; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_calendar_items_due_at ON public.calendar_items USING btree (due_at);


--
-- Name: idx_calendar_items_project_id; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_calendar_items_project_id ON public.calendar_items USING btree (project_id);


--
-- Name: idx_calendar_items_start_at; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_calendar_items_start_at ON public.calendar_items USING btree (start_at);


--
-- Name: idx_calendar_items_updated_at; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_calendar_items_updated_at ON public.calendar_items USING btree (updated_at);


--
-- Name: idx_daily_logs_owner_date; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_daily_logs_owner_date ON public.daily_logs USING btree (owner_id, date);


--
-- Name: idx_gcal_links_user_id; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_gcal_links_user_id ON public.gcal_links USING btree (user_id);


--
-- Name: idx_group_activity_group_date; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_group_activity_group_date ON public.group_activity_daily USING btree (group_id, activity_date DESC);


--
-- Name: idx_group_activity_group_user; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_group_activity_group_user ON public.group_activity_daily USING btree (group_id, user_id);


--
-- Name: idx_group_removal_group_created; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_group_removal_group_created ON public.group_removal_log USING btree (group_id, created_at DESC);


--
-- Name: idx_group_removal_product; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_group_removal_product ON public.group_removal_log USING btree (product_id);


--
-- Name: idx_habit_logs_owner_at; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_habit_logs_owner_at ON public.habit_logs USING btree (owner_id, at);


--
-- Name: idx_habits_owner_area; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_habits_owner_area ON public.habits USING btree (owner_id, area_id);


--
-- Name: idx_habits_owner_project; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_habits_owner_project ON public.habits USING btree (owner_id, project_id);


--
-- Name: idx_habits_project; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_habits_project ON public.habits USING btree (project_id);


--
-- Name: idx_notes_owner_archived; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_notes_owner_archived ON public.notes USING btree (owner_id, archived_at);


--
-- Name: idx_notes_owner_area; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_notes_owner_area ON public.notes USING btree (owner_id, area_id);


--
-- Name: idx_notes_owner_area_pinned_order; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_notes_owner_area_pinned_order ON public.notes USING btree (owner_id, area_id, pinned DESC, order_index);


--
-- Name: idx_notes_owner_project; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_notes_owner_project ON public.notes USING btree (owner_id, project_id);


--
-- Name: idx_project_notifications_project_id; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_project_notifications_project_id ON public.project_notifications USING btree (project_id);


--
-- Name: idx_rewards_owner_area; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_rewards_owner_area ON public.rewards USING btree (owner_id, area_id);


--
-- Name: idx_user_settings_user; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_user_settings_user ON public.user_settings USING btree (user_id);


--
-- Name: idx_users_products_product; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_users_products_product ON public.users_products USING btree (product_id);


--
-- Name: idx_users_products_status; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX idx_users_products_status ON public.users_products USING btree (status);


--
-- Name: ix_areas_owner; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_areas_owner ON public.areas USING btree (owner_id);


--
-- Name: ix_auth_audit_actor; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_auth_audit_actor ON public.auth_audit_entries USING btree (actor_user_id, created_at DESC);


--
-- Name: ix_auth_audit_target; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_auth_audit_target ON public.auth_audit_entries USING btree (target_user_id, created_at DESC);


--
-- Name: ix_calendar_items_area; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_calendar_items_area ON public.calendar_items USING btree (area_id);


--
-- Name: ix_calendar_items_project; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_calendar_items_project ON public.calendar_items USING btree (project_id);


--
-- Name: ix_diagnostic_clients_last_result; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_diagnostic_clients_last_result ON public.diagnostic_clients USING btree (last_result_at DESC);


--
-- Name: ix_diagnostic_clients_specialist; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_diagnostic_clients_specialist ON public.diagnostic_clients USING btree (specialist_id, in_archive, is_new);


--
-- Name: ix_diagnostic_results_client; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_diagnostic_results_client ON public.diagnostic_results USING btree (client_id, submitted_at DESC);


--
-- Name: ix_diagnostic_results_specialist; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_diagnostic_results_specialist ON public.diagnostic_results USING btree (specialist_id, submitted_at DESC);


--
-- Name: ix_entity_profile_grants_profile; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_entity_profile_grants_profile ON public.entity_profile_grants USING btree (profile_id);


--
-- Name: ix_entity_profile_grants_subject; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_entity_profile_grants_subject ON public.entity_profile_grants USING btree (audience_type, subject_id) WHERE (subject_id IS NOT NULL);


--
-- Name: ix_entity_profiles_updated; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_entity_profiles_updated ON public.entity_profiles USING btree (entity_type, updated_at DESC);


--
-- Name: ix_projects_area_id; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_projects_area_id ON public.projects USING btree (area_id);


--
-- Name: ix_resources_area; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_resources_area ON public.resources USING btree (area_id);


--
-- Name: ix_resources_human; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_resources_human ON public.resources USING btree (human_user_id);


--
-- Name: ix_resources_project; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_resources_project ON public.resources USING btree (project_id);


--
-- Name: ix_task_reminders_active; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_task_reminders_active ON public.task_reminders USING btree (task_id, trigger_at);


--
-- Name: ix_user_roles_scope; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_user_roles_scope ON public.user_roles USING btree (scope_type, scope_id);


--
-- Name: ix_user_roles_user; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX ix_user_roles_user ON public.user_roles USING btree (user_id);


--
-- Name: notes_owner_arch_idx; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX notes_owner_arch_idx ON public.notes USING btree (owner_id, archived_at);


--
-- Name: notes_owner_area_idx; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX notes_owner_area_idx ON public.notes USING btree (owner_id, area_id);


--
-- Name: notes_pin_order_idx; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE INDEX notes_pin_order_idx ON public.notes USING btree (owner_id, pinned DESC, order_index);


--
-- Name: ux_auth_permissions_bit; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_auth_permissions_bit ON public.auth_permissions USING btree (bit_position);


--
-- Name: ux_auth_permissions_code; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_auth_permissions_code ON public.auth_permissions USING btree (code);


--
-- Name: ux_entity_profile_grants_public; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_entity_profile_grants_public ON public.entity_profile_grants USING btree (profile_id, audience_type) WHERE (audience_type = ANY (ARRAY['public'::text, 'authenticated'::text]));


--
-- Name: ux_entity_profile_grants_target; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_entity_profile_grants_target ON public.entity_profile_grants USING btree (profile_id, audience_type, subject_id) WHERE (audience_type <> ALL (ARRAY['public'::text, 'authenticated'::text]));


--
-- Name: ux_entity_profiles_entity; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_entity_profiles_entity ON public.entity_profiles USING btree (entity_type, entity_id);


--
-- Name: ux_entity_profiles_slug; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_entity_profiles_slug ON public.entity_profiles USING btree (entity_type, lower(slug));


--
-- Name: ux_overrides_owner_entity; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_overrides_owner_entity ON public.para_overrides USING btree (owner_user_id, entity_type, entity_id);


--
-- Name: ux_roles_slug; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_roles_slug ON public.roles USING btree (slug);


--
-- Name: ux_task_watchers_active; Type: INDEX; Schema: public; Owner: intdatadb
--

CREATE UNIQUE INDEX ux_task_watchers_active ON public.task_watchers USING btree (task_id, watcher_id) WHERE (state = 'active'::public.taskwatcherstate);


--
-- Name: alarms alarms_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.alarms
    ADD CONSTRAINT alarms_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.calendar_items(id);


--
-- Name: archives archives_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.archives
    ADD CONSTRAINT archives_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: areas areas_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: areas areas_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.areas(id) ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: calendar_items calendar_items_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_items
    ADD CONSTRAINT calendar_items_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: calendar_items calendar_items_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_items
    ADD CONSTRAINT calendar_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: calendar_items calendar_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.calendar_items
    ADD CONSTRAINT calendar_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: channels channels_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: dailies dailies_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.dailies
    ADD CONSTRAINT dailies_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: dailies dailies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.dailies
    ADD CONSTRAINT dailies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_web(id);


--
-- Name: dailies dailies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.dailies
    ADD CONSTRAINT dailies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: daily_logs daily_logs_daily_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.daily_logs
    ADD CONSTRAINT daily_logs_daily_id_fkey FOREIGN KEY (daily_id) REFERENCES public.dailies(id) ON DELETE CASCADE;


--
-- Name: diagnostic_clients diagnostic_clients_specialist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_clients
    ADD CONSTRAINT diagnostic_clients_specialist_id_fkey FOREIGN KEY (specialist_id) REFERENCES public.users_web(id) ON DELETE SET NULL;


--
-- Name: diagnostic_clients diagnostic_clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_clients
    ADD CONSTRAINT diagnostic_clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_web(id) ON DELETE CASCADE;


--
-- Name: diagnostic_results diagnostic_results_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_results
    ADD CONSTRAINT diagnostic_results_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.diagnostic_clients(id) ON DELETE CASCADE;


--
-- Name: diagnostic_results diagnostic_results_diagnostic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_results
    ADD CONSTRAINT diagnostic_results_diagnostic_id_fkey FOREIGN KEY (diagnostic_id) REFERENCES public.diagnostic_templates(id);


--
-- Name: diagnostic_results diagnostic_results_specialist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.diagnostic_results
    ADD CONSTRAINT diagnostic_results_specialist_id_fkey FOREIGN KEY (specialist_id) REFERENCES public.users_web(id) ON DELETE SET NULL;


--
-- Name: entity_profile_grants entity_profile_grants_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.entity_profile_grants
    ADD CONSTRAINT entity_profile_grants_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_web(id);


--
-- Name: entity_profile_grants entity_profile_grants_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.entity_profile_grants
    ADD CONSTRAINT entity_profile_grants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.entity_profiles(id) ON DELETE CASCADE;


--
-- Name: auth_audit_entries fk_auth_audit_actor; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.auth_audit_entries
    ADD CONSTRAINT fk_auth_audit_actor FOREIGN KEY (actor_user_id) REFERENCES public.users_web(id);


--
-- Name: auth_audit_entries fk_auth_audit_target; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.auth_audit_entries
    ADD CONSTRAINT fk_auth_audit_target FOREIGN KEY (target_user_id) REFERENCES public.users_web(id);


--
-- Name: user_roles fk_user_roles_granted_by; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_granted_by FOREIGN KEY (granted_by) REFERENCES public.users_web(id);


--
-- Name: gcal_links gcal_links_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.gcal_links
    ADD CONSTRAINT gcal_links_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: group_activity_daily group_activity_daily_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_activity_daily
    ADD CONSTRAINT group_activity_daily_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(telegram_id) ON DELETE CASCADE;


--
-- Name: group_activity_daily group_activity_daily_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_activity_daily
    ADD CONSTRAINT group_activity_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_tg(telegram_id) ON DELETE CASCADE;


--
-- Name: group_removal_log group_removal_log_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_removal_log
    ADD CONSTRAINT group_removal_log_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(telegram_id) ON DELETE CASCADE;


--
-- Name: group_removal_log group_removal_log_initiator_web_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_removal_log
    ADD CONSTRAINT group_removal_log_initiator_web_id_fkey FOREIGN KEY (initiator_web_id) REFERENCES public.users_web(id);


--
-- Name: group_removal_log group_removal_log_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_removal_log
    ADD CONSTRAINT group_removal_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: group_removal_log group_removal_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.group_removal_log
    ADD CONSTRAINT group_removal_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: groups groups_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: habit_logs habit_logs_habit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.habit_logs
    ADD CONSTRAINT habit_logs_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;


--
-- Name: habits habits_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: interfaces interfaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.interfaces
    ADD CONSTRAINT interfaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: key_results key_results_okr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.key_results
    ADD CONSTRAINT key_results_okr_id_fkey FOREIGN KEY (okr_id) REFERENCES public.okrs(id);


--
-- Name: limits limits_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.limits
    ADD CONSTRAINT limits_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: notes notes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: notification_channels notification_channels_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notification_channels
    ADD CONSTRAINT notification_channels_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: notification_triggers notification_triggers_alarm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.notification_triggers
    ADD CONSTRAINT notification_triggers_alarm_id_fkey FOREIGN KEY (alarm_id) REFERENCES public.alarms(id);


--
-- Name: okrs okrs_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.okrs
    ADD CONSTRAINT okrs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: project_notifications project_notifications_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.project_notifications
    ADD CONSTRAINT project_notifications_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.notification_channels(id);


--
-- Name: project_notifications project_notifications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.project_notifications
    ADD CONSTRAINT project_notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: projects projects_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: reminders reminders_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: reminders reminders_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: resources resources_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: rewards rewards_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: rewards rewards_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_web(id);


--
-- Name: rewards rewards_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.rewards
    ADD CONSTRAINT rewards_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: schedule_exceptions schedule_exceptions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: task_checkpoints task_checkpoints_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_checkpoints
    ADD CONSTRAINT task_checkpoints_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: task_reminders task_reminders_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_reminders
    ADD CONSTRAINT task_reminders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: task_reminders task_reminders_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_reminders
    ADD CONSTRAINT task_reminders_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_watchers task_watchers_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_watchers
    ADD CONSTRAINT task_watchers_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users_tg(telegram_id);


--
-- Name: task_watchers task_watchers_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_watchers
    ADD CONSTRAINT task_watchers_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_watchers task_watchers_watcher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.task_watchers
    ADD CONSTRAINT task_watchers_watcher_id_fkey FOREIGN KEY (watcher_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: tasks tasks_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: tasks tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: time_entries time_entries_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id);


--
-- Name: time_entries time_entries_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: time_entries time_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: time_entries time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: user_group user_group_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_group
    ADD CONSTRAINT user_group_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(telegram_id);


--
-- Name: user_group user_group_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_group
    ADD CONSTRAINT user_group_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_tg(telegram_id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_web(id);


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_web(id) ON DELETE CASCADE;


--
-- Name: user_stats user_stats_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users_web(id);


--
-- Name: users_products users_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_products
    ADD CONSTRAINT users_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: users_products users_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_products
    ADD CONSTRAINT users_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users_tg(telegram_id) ON DELETE CASCADE;


--
-- Name: users_web_tg users_web_tg_tg_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web_tg
    ADD CONSTRAINT users_web_tg_tg_user_id_fkey FOREIGN KEY (tg_user_id) REFERENCES public.users_tg(id);


--
-- Name: users_web_tg users_web_tg_web_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: intdatadb
--

ALTER TABLE ONLY public.users_web_tg
    ADD CONSTRAINT users_web_tg_web_user_id_fkey FOREIGN KEY (web_user_id) REFERENCES public.users_web(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 5kM5oq5cMVFCbiWXgAtgfDDldTfTE5n3lAscUNv3VhCPSGQP7iwf5b6c1hrWA2W

