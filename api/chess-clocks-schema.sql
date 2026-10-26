-- Additive upgrade for an existing chess room. Existing games remain untimed.
CREATE TABLE IF NOT EXISTS pc_chess_invite_options (
 invite_id CHAR(32) NOT NULL PRIMARY KEY,
 time_seconds INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS pc_chess_clocks (
 game_id CHAR(32) NOT NULL PRIMARY KEY,
 time_seconds INT NOT NULL DEFAULT 0,
 white_ms BIGINT NOT NULL DEFAULT 0,
 black_ms BIGINT NOT NULL DEFAULT 0,
 tick_ms BIGINT NOT NULL DEFAULT 0,
 INDEX chess_clock_running (tick_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
