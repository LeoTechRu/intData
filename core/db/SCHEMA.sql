CREATE TABLE alarms (
	id SERIAL NOT NULL, 
	item_id INTEGER NOT NULL, 
	trigger_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	is_sent BOOLEAN, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(item_id) REFERENCES calendar_items (id)
);

CREATE TABLE archives (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	source_type VARCHAR(50), 
	source_id INTEGER, 
	archived_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE areas (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	name VARCHAR(255) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	type areatype, 
	color VARCHAR(7) NOT NULL, 
	context_map JSON, 
	review_interval INTEGER, 
	review_interval_days INTEGER, 
	is_active BOOLEAN, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	parent_id INTEGER, 
	mp_path VARCHAR NOT NULL, 
	depth INTEGER NOT NULL, 
	slug VARCHAR NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(parent_id) REFERENCES areas (id) ON DELETE SET NULL
);

CREATE TABLE auth_audit_entries (
	id SERIAL NOT NULL, 
	actor_user_id INTEGER, 
	target_user_id INTEGER NOT NULL, 
	action VARCHAR(50) NOT NULL, 
	role_slug VARCHAR(50), 
	scope_type VARCHAR(20) NOT NULL, 
	scope_id INTEGER, 
	details JSON, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(actor_user_id) REFERENCES users_web (id), 
	FOREIGN KEY(target_user_id) REFERENCES users_web (id)
);

CREATE TABLE auth_permissions (
	id SERIAL NOT NULL, 
	code VARCHAR(100) NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	description VARCHAR(255), 
	category VARCHAR(64), 
	bit_position INTEGER NOT NULL, 
	mutable BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (code), 
	UNIQUE (bit_position)
);

CREATE TABLE calendar_events (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	title VARCHAR(255) NOT NULL, 
	start_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_at TIMESTAMP WITH TIME ZONE, 
	description VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE calendar_items (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	title VARCHAR(255) NOT NULL, 
	start_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_at TIMESTAMP WITH TIME ZONE, 
	project_id INTEGER, 
	area_id INTEGER, 
	status calendaritemstatus, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(area_id) REFERENCES areas (id)
);

CREATE TABLE channels (
	id BIGSERIAL NOT NULL, 
	telegram_id BIGINT NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	type channeltype, 
	owner_id BIGINT, 
	username VARCHAR(32), 
	participants_count INTEGER, 
	description VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (telegram_id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE dailies (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	area_id INTEGER NOT NULL, 
	project_id INTEGER, 
	title VARCHAR(255) NOT NULL, 
	note TEXT, 
	rrule TEXT NOT NULL, 
	difficulty VARCHAR(8) NOT NULL, 
	streak INTEGER, 
	frozen BOOLEAN, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_web (id), 
	FOREIGN KEY(area_id) REFERENCES areas (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);

CREATE TABLE daily_logs (
	id SERIAL NOT NULL, 
	daily_id INTEGER, 
	owner_id BIGINT, 
	date DATE NOT NULL, 
	done BOOLEAN NOT NULL, 
	reward_xp INTEGER, 
	reward_gold INTEGER, 
	penalty_hp INTEGER, 
	PRIMARY KEY (id), 
	CONSTRAINT ux_daily_date UNIQUE (daily_id, date), 
	FOREIGN KEY(daily_id) REFERENCES dailies (id) ON DELETE CASCADE
);

CREATE TABLE entity_profile_grants (
	id SERIAL NOT NULL, 
	profile_id INTEGER NOT NULL, 
	audience_type VARCHAR(32) NOT NULL, 
	subject_id BIGINT, 
	sections JSON, 
	created_by INTEGER, 
	expires_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(profile_id) REFERENCES entity_profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by) REFERENCES users_web (id)
);

CREATE TABLE entity_profiles (
	id SERIAL NOT NULL, 
	entity_type VARCHAR(32) NOT NULL, 
	entity_id BIGINT NOT NULL, 
	slug VARCHAR(255) NOT NULL, 
	display_name VARCHAR(255) NOT NULL, 
	headline VARCHAR(255), 
	summary TEXT, 
	avatar_url VARCHAR(512), 
	cover_url VARCHAR(512), 
	tags JSON, 
	profile_meta JSON, 
	sections JSON, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_entity_profiles_entity UNIQUE (entity_type, entity_id), 
	CONSTRAINT uq_entity_profiles_slug UNIQUE (entity_type, slug)
);

CREATE TABLE gcal_links (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	calendar_id VARCHAR(255) NOT NULL, 
	access_token VARCHAR(255), 
	refresh_token VARCHAR(255), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE group_activity_daily (
	group_id BIGINT NOT NULL, 
	user_id BIGINT NOT NULL, 
	activity_date DATE NOT NULL, 
	messages_count INTEGER NOT NULL, 
	reactions_count INTEGER NOT NULL, 
	last_activity_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (group_id, user_id, activity_date), 
	FOREIGN KEY(group_id) REFERENCES groups (telegram_id), 
	FOREIGN KEY(user_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE group_removal_log (
	id BIGSERIAL NOT NULL, 
	group_id BIGINT NOT NULL, 
	user_id BIGINT NOT NULL, 
	product_id INTEGER, 
	initiator_web_id INTEGER, 
	initiator_tg_id BIGINT, 
	reason VARCHAR(255), 
	result VARCHAR(32) NOT NULL, 
	details JSON, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(group_id) REFERENCES groups (telegram_id), 
	FOREIGN KEY(user_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(initiator_web_id) REFERENCES users_web (id)
);

CREATE TABLE groups (
	id BIGSERIAL NOT NULL, 
	telegram_id BIGINT NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	type grouptype, 
	owner_id BIGINT, 
	description VARCHAR(500), 
	participants_count INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (telegram_id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE habit_logs (
	id SERIAL NOT NULL, 
	habit_id INTEGER, 
	owner_id BIGINT, 
	at TIMESTAMP WITH TIME ZONE, 
	delta INTEGER, 
	reward_xp INTEGER, 
	reward_gold INTEGER, 
	penalty_hp INTEGER, 
	val_after FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(habit_id) REFERENCES habits (id) ON DELETE CASCADE
);

CREATE TABLE habits (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	area_id INTEGER NOT NULL, 
	project_id INTEGER, 
	title VARCHAR(255) NOT NULL, 
	note TEXT, 
	type VARCHAR(8) NOT NULL, 
	difficulty VARCHAR(8) NOT NULL, 
	up_enabled BOOLEAN, 
	down_enabled BOOLEAN, 
	val FLOAT, 
	daily_limit INTEGER DEFAULT '10', 
	cooldown_sec INTEGER DEFAULT '60', 
	last_action_at TIMESTAMP WITH TIME ZONE, 
	tags JSON, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_web (id), 
	FOREIGN KEY(area_id) REFERENCES areas (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);

CREATE TABLE interfaces (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	name VARCHAR(255) NOT NULL, 
	config JSON, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE key_results (
	id SERIAL NOT NULL, 
	okr_id INTEGER, 
	description VARCHAR(255) NOT NULL, 
	metric_type metrictype, 
	weight FLOAT, 
	target_value FLOAT, 
	current_value FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(okr_id) REFERENCES okrs (id)
);

CREATE TABLE limits (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	resource VARCHAR(50) NOT NULL, 
	value INTEGER NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE links (
	id SERIAL NOT NULL, 
	source_type VARCHAR(50), 
	source_id INTEGER, 
	target_type VARCHAR(50), 
	target_id INTEGER, 
	link_type linktype, 
	weight FLOAT, 
	decay FLOAT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE log_settings (
	id BIGSERIAL NOT NULL, 
	chat_id BIGINT NOT NULL, 
	level loglevel, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE notes (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	title TEXT, 
	content TEXT NOT NULL, 
	area_id INTEGER NOT NULL, 
	project_id INTEGER, 
	container_type containertype, 
	container_id INTEGER, 
	color VARCHAR(20), 
	pinned BOOLEAN, 
	order_index INTEGER, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(area_id) REFERENCES areas (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);

CREATE TABLE notification_channels (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	kind notificationchannelkind NOT NULL, 
	address JSON NOT NULL, 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE notification_triggers (
	id SERIAL NOT NULL, 
	next_fire_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	alarm_id INTEGER, 
	rule JSON, 
	dedupe_key VARCHAR(255) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(alarm_id) REFERENCES alarms (id), 
	UNIQUE (dedupe_key)
);

CREATE TABLE notifications (
	id SERIAL NOT NULL, 
	dedupe_key VARCHAR(255) NOT NULL, 
	sent_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (dedupe_key)
);

CREATE TABLE okrs (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	objective VARCHAR(255) NOT NULL, 
	description VARCHAR(500), 
	status okrstatus, 
	period_start DATE, 
	period_end DATE, 
	confidence INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE products (
	id SERIAL NOT NULL, 
	slug VARCHAR(64) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	active BOOLEAN NOT NULL, 
	attributes JSON, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (slug)
);

CREATE TABLE project_notifications (
	id SERIAL NOT NULL, 
	project_id INTEGER NOT NULL, 
	channel_id INTEGER NOT NULL, 
	rules JSON, 
	is_enabled BOOLEAN, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(channel_id) REFERENCES notification_channels (id)
);

CREATE TABLE projects (
	id SERIAL NOT NULL, 
	area_id INTEGER NOT NULL, 
	owner_id BIGINT, 
	name VARCHAR(255) NOT NULL, 
	description VARCHAR(500), 
	cognitive_cost INTEGER, 
	neural_priority FLOAT, 
	schedule JSON, 
	metrics JSON, 
	start_date TIMESTAMP WITHOUT TIME ZONE, 
	end_date TIMESTAMP WITHOUT TIME ZONE, 
	status projectstatus, 
	slug VARCHAR(255), 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(area_id) REFERENCES areas (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE resources (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	title VARCHAR(255) NOT NULL, 
	content VARCHAR(2000), 
	type VARCHAR(50), 
	meta JSON, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE rewards (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	title VARCHAR(255) NOT NULL, 
	cost_gold INTEGER, 
	area_id INTEGER NOT NULL, 
	project_id INTEGER, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_web (id), 
	FOREIGN KEY(area_id) REFERENCES areas (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id)
);

CREATE TABLE roles (
	id SERIAL NOT NULL, 
	slug VARCHAR(50) NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	level INTEGER, 
	description VARCHAR(255), 
	permissions_mask BIGINT NOT NULL, 
	is_system BOOLEAN NOT NULL, 
	grants_all BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (slug), 
	UNIQUE (name)
);

CREATE TABLE schedule_exceptions (
	id SERIAL NOT NULL, 
	task_id INTEGER, 
	date DATE, 
	reason VARCHAR(255), 
	PRIMARY KEY (id), 
	FOREIGN KEY(task_id) REFERENCES tasks (id)
);

CREATE TABLE task_checkpoints (
	id SERIAL NOT NULL, 
	task_id INTEGER, 
	name VARCHAR(255), 
	completed BOOLEAN, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(task_id) REFERENCES tasks (id)
);

CREATE TABLE task_reminders (
	id SERIAL NOT NULL, 
	task_id INTEGER NOT NULL, 
	owner_id BIGINT NOT NULL, 
	kind VARCHAR(32) NOT NULL, 
	trigger_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	frequency_minutes INTEGER, 
	is_active BOOLEAN NOT NULL, 
	last_triggered_at TIMESTAMP WITH TIME ZONE, 
	payload JSON, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(task_id) REFERENCES tasks (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
);

CREATE TABLE task_watchers (
	id SERIAL NOT NULL, 
	task_id INTEGER NOT NULL, 
	watcher_id BIGINT NOT NULL, 
	added_by BIGINT, 
	state taskwatcherstate NOT NULL, 
	left_reason taskwatcherleftreason, 
	left_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(task_id) REFERENCES tasks (id), 
	FOREIGN KEY(watcher_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(added_by) REFERENCES users_tg (telegram_id)
);

CREATE TABLE tasks (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	title VARCHAR(255) NOT NULL, 
	description VARCHAR(500), 
	due_date TIMESTAMP WITH TIME ZONE, 
	status taskstatus, 
	cognitive_cost INTEGER, 
	neural_priority FLOAT, 
	repeat_config JSON, 
	recurrence VARCHAR(50), 
	excluded_dates JSON, 
	custom_properties JSON, 
	schedule_type VARCHAR(50), 
	reschedule_count INTEGER, 
	control_enabled BOOLEAN NOT NULL, 
	control_frequency INTEGER, 
	control_status taskcontrolstatus NOT NULL, 
	control_next_at TIMESTAMP WITH TIME ZONE, 
	refused_reason taskrefusereason, 
	remind_policy JSON, 
	is_watched BOOLEAN NOT NULL, 
	project_id INTEGER, 
	area_id INTEGER, 
	estimate_minutes INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(area_id) REFERENCES areas (id)
);

CREATE TABLE time_entries (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	task_id INTEGER, 
	start_time TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_time TIMESTAMP WITH TIME ZONE, 
	description VARCHAR(500), 
	project_id INTEGER, 
	area_id INTEGER, 
	activity_type activitytype, 
	billable BOOLEAN, 
	source timesource, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(task_id) REFERENCES tasks (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id), 
	FOREIGN KEY(area_id) REFERENCES areas (id)
);

CREATE TABLE user_group (
	user_id BIGINT NOT NULL, 
	group_id BIGINT NOT NULL, 
	is_owner BOOLEAN, 
	is_moderator BOOLEAN, 
	joined_at TIMESTAMP WITH TIME ZONE, 
	crm_notes TEXT, 
	trial_expires_at TIMESTAMP WITH TIME ZONE, 
	crm_tags JSON, 
	crm_metadata JSON, 
	PRIMARY KEY (user_id, group_id), 
	FOREIGN KEY(user_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(group_id) REFERENCES groups (telegram_id)
);

CREATE TABLE user_roles (
	id SERIAL NOT NULL, 
	user_id INTEGER, 
	role_id INTEGER, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	scope_type VARCHAR(20) NOT NULL, 
	scope_id INTEGER, 
	granted_by INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (user_id, role_id, scope_type, scope_id), 
	FOREIGN KEY(user_id) REFERENCES users_web (id), 
	FOREIGN KEY(role_id) REFERENCES roles (id), 
	FOREIGN KEY(granted_by) REFERENCES users_web (id)
);

CREATE TABLE user_settings (
	id BIGSERIAL NOT NULL, 
	user_id BIGINT NOT NULL, 
	key VARCHAR(64) NOT NULL, 
	value JSONB NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_settings_user_key UNIQUE (user_id, key), 
	FOREIGN KEY(user_id) REFERENCES users_web (id) ON DELETE CASCADE
);

CREATE TABLE user_stats (
	owner_id BIGINT NOT NULL, 
	level INTEGER, 
	xp INTEGER, 
	gold INTEGER, 
	hp INTEGER, 
	kp BIGINT, 
	daily_xp INTEGER DEFAULT '0', 
	daily_gold INTEGER DEFAULT '0', 
	last_cron DATE, 
	PRIMARY KEY (owner_id), 
	FOREIGN KEY(owner_id) REFERENCES users_web (id)
);

CREATE TABLE users_favorites (
	id SERIAL NOT NULL, 
	owner_id INTEGER NOT NULL, 
	label VARCHAR(40), 
	path VARCHAR(128) NOT NULL, 
	position INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (owner_id, path), 
	FOREIGN KEY(owner_id) REFERENCES users_web (id)
);

CREATE TABLE users_products (
	user_id BIGINT NOT NULL, 
	product_id INTEGER NOT NULL, 
	status product_status NOT NULL, 
	source VARCHAR(64), 
	acquired_at TIMESTAMP WITH TIME ZONE, 
	notes TEXT, 
	extra JSON, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (user_id, product_id), 
	FOREIGN KEY(user_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);

CREATE TABLE users_tg (
	id SERIAL NOT NULL, 
	telegram_id BIGINT NOT NULL, 
	username VARCHAR(32), 
	first_name VARCHAR(255), 
	last_name VARCHAR(255), 
	language_code VARCHAR(10), 
	role VARCHAR(20), 
	bot_settings JSON, 
	ics_token_hash VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (telegram_id), 
	UNIQUE (username)
);

CREATE TABLE users_web (
	id SERIAL NOT NULL, 
	username VARCHAR(64) NOT NULL, 
	email VARCHAR(255), 
	phone VARCHAR(20), 
	full_name VARCHAR(255), 
	password_hash VARCHAR(255), 
	role VARCHAR(20), 
	privacy_settings JSON, 
	birthday DATE, 
	language VARCHAR(10), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (username)
);

CREATE TABLE users_web_tg (
	id SERIAL NOT NULL, 
	web_user_id INTEGER NOT NULL, 
	tg_user_id INTEGER NOT NULL, 
	link_type VARCHAR(50), 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(web_user_id) REFERENCES users_web (id), 
	UNIQUE (tg_user_id), 
	FOREIGN KEY(tg_user_id) REFERENCES users_tg (id)
);

CREATE INDEX ix_group_removal_group_created ON group_removal_log (group_id, created_at);

CREATE INDEX ix_group_removal_product ON group_removal_log (product_id);

CREATE INDEX ix_task_reminders_active ON task_reminders (task_id, trigger_at);

CREATE UNIQUE INDEX ux_task_watchers_active ON task_watchers (task_id, watcher_id) WHERE state = 'active';

CREATE INDEX ix_users_favorites_owner_position ON users_favorites (owner_id, position);

CREATE UNIQUE INDEX ix_users_web_username_ci ON users_web (lower(username));
