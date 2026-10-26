-- Additive migration only. Import once into the existing Počítáme database.
CREATE TABLE IF NOT EXISTS pc_chess_presence (
 user_id INT NOT NULL PRIMARY KEY,
 last_seen DATETIME NOT NULL,
 INDEX chess_online (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS pc_chess_invites (
 id CHAR(32) NOT NULL PRIMARY KEY,
 from_id INT NOT NULL,
 to_id INT NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'pending',
 game_id CHAR(32) NULL,
 created_at DATETIME NOT NULL,
 expires_at DATETIME NOT NULL,
 INDEX chess_incoming (to_id,status,expires_at),
 INDEX chess_outgoing (from_id,status,expires_at),
 INDEX chess_expiry (status,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS pc_chess_games (
 id CHAR(32) NOT NULL PRIMARY KEY,
 white_id INT NOT NULL,
 black_id INT NOT NULL,
 fen VARCHAR(120) NOT NULL,
 history MEDIUMTEXT NOT NULL,
 status VARCHAR(12) NOT NULL DEFAULT 'active',
 reason VARCHAR(24) NULL,
 winner_id INT NULL,
 draw_offer INT NULL,
 revision INT NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 INDEX chess_white (white_id,status,updated_at),
 INDEX chess_black (black_id,status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
