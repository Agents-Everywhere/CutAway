import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const EVENT_ID = "pottery-saturday";

export interface EventRow {
  id: string;
  title: string;
  capacity: number;
}

export interface ReservationRow {
  id: string;
  event_id: string;
  customer_name: string;
  customer_email: string;
  request_id: string;
  created_at: string;
}

export function openDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity >= 0)
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id),
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      request_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reservations_event ON reservations(event_id);
  `);
  const eventCount = db
    .prepare("SELECT COUNT(*) AS count FROM events")
    .get() as {
    count: number;
  };
  // A restart opens existing data. Only a brand-new database gets the demo seed.
  if (eventCount.count === 0) {
    db.transaction(() => {
      db.prepare(
        "INSERT INTO events (id, title, capacity) VALUES (?, ?, ?)",
      ).run(EVENT_ID, "Saturday pottery workshop", 2);
      db.prepare(
        `
        INSERT INTO reservations
          (id, event_id, customer_name, customer_email, request_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      ).run(
        "existing-morgan",
        EVENT_ID,
        "Morgan Reed",
        "morgan@example.test",
        "seed-morgan",
        "2026-09-10T14:00:00.000Z",
      );
    })();
  }
  return db;
}

export function getEvent(db: Database.Database, eventId: string) {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId) as
    EventRow | undefined;
  if (!event) return null;
  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM reservations WHERE event_id = ?")
    .get(eventId) as { count: number };
  return { ...event, reserved: count, available: event.capacity - count };
}

export function listReservations(db: Database.Database, eventId: string) {
  const rows = db
    .prepare(
      "SELECT * FROM reservations WHERE event_id = ? ORDER BY created_at, id",
    )
    .all(eventId) as ReservationRow[];
  return rows.map(toReservation);
}

export function toReservation(row: ReservationRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    requestId: row.request_id,
    createdAt: row.created_at,
  };
}
