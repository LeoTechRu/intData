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
	type areatype, 
	color VARCHAR(7), 
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

CREATE TABLE habits (
	id SERIAL NOT NULL, 
	owner_id BIGINT, 
	name VARCHAR(255) NOT NULL, 
	description VARCHAR(500), 
	schedule JSON, 
	metrics JSON, 
	frequency VARCHAR(20), 
	progress JSON, 
	start_date TIMESTAMP WITHOUT TIME ZONE, 
	end_date TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
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
	title VARCHAR(255), 
	content TEXT NOT NULL, 
	container_type containertype, 
	container_id INTEGER, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES users_tg (telegram_id)
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

CREATE TABLE perms (
	id SERIAL NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	description VARCHAR(255), 
	PRIMARY KEY (id), 
	UNIQUE (name)
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

CREATE TABLE roles (
	id SERIAL NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	level INTEGER, 
	description VARCHAR(255), 
	PRIMARY KEY (id), 
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
	PRIMARY KEY (user_id, group_id), 
	FOREIGN KEY(user_id) REFERENCES users_tg (telegram_id), 
	FOREIGN KEY(group_id) REFERENCES groups (telegram_id)
);

CREATE TABLE user_roles (
	id SERIAL NOT NULL, 
	user_id INTEGER, 
	role_id INTEGER, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users_web (id), 
	FOREIGN KEY(role_id) REFERENCES roles (id)
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

CREATE INDEX ix_users_favorites_owner_position ON users_favorites (owner_id, position);

CREATE UNIQUE INDEX ix_users_web_username_ci ON users_web (lower(username));
