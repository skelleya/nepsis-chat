import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// DATA_DIR env var allows persistent storage on Fly.io volumes; defaults to backend root
const dataDir = process.env.DATA_DIR || join(__dirname, '../..')
const db = new Database(join(dataDir, 'data.sqlite'))

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT,
    owner_id TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
    "order" INTEGER DEFAULT 0,
    FOREIGN KEY (server_id) REFERENCES servers(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS dm_conversations (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dm_participants (
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS dm_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Seed initial data
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get()
if (userCount.c === 0) {
  db.exec(`
    INSERT INTO users (id, username) VALUES ('u1', 'You'), ('u2', 'Alice'), ('u3', 'Bob');
    INSERT INTO servers (id, name, owner_id) VALUES ('1', 'Nepsis Chat', 'u1'), ('2', 'Gaming Hub', 'u1');
    INSERT INTO channels (id, server_id, name, type, "order") VALUES
      ('c1', '1', 'general', 'text', 0),
      ('c2', '1', 'voice-chat', 'voice', 1),
      ('c3', '1', 'announcements', 'text', 2),
      ('c4', '2', 'lobby', 'voice', 0);
    INSERT INTO messages (id, channel_id, user_id, content) VALUES
      ('m1', 'c1', 'u1', 'Welcome to Nepsis Chat!'),
      ('m2', 'c1', 'u2', 'Hi everyone!');
  `)
}

export default db
