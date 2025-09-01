CREATE TABLE IF NOT EXISTS habits (
    id SERIAL PRIMARY KEY,
    owner_id BIGINT REFERENCES users_tg(telegram_id),
    area_id INTEGER NOT NULL REFERENCES areas(id),
    project_id INTEGER REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    schedule JSON,
    metrics JSON,
    frequency VARCHAR(20),
    progress JSON,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
