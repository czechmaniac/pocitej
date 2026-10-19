-- Minimal isolated fixture for the existing API tables; never import into production.
CREATE TABLE pc_users (id INT PRIMARY KEY AUTO_INCREMENT,nickname VARCHAR(24) UNIQUE,pin_hash VARCHAR(255),preferences TEXT,created_at DATETIME,lifetime_sets INT NOT NULL DEFAULT 0);
CREATE TABLE pc_tokens (token_hash CHAR(64) PRIMARY KEY,user_id INT,expires_at DATETIME);
CREATE TABLE pc_sets (id CHAR(32) PRIMARY KEY,user_id INT,week_start DATE,settings TEXT,exercises TEXT,created_at DATETIME,completed INT NOT NULL DEFAULT 0);
CREATE TABLE pc_weeks (user_id INT,week_start DATE,solved INT NOT NULL DEFAULT 0,correct INT NOT NULL DEFAULT 0,completed_sets INT NOT NULL DEFAULT 0,streak INT NOT NULL DEFAULT 0,best_streak INT NOT NULL DEFAULT 0,last_used DATE,PRIMARY KEY(user_id,week_start));
