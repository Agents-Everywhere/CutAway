import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { getEvent, toReservation, type ReservationRow } from "./database.js";

export interface ReservationInput {
  eventId: string;
  customerName: string;
  customerEmail: string;
  requestId: string;
}

export type ReservationResult =
  | { status: 201; reservation: ReturnType<typeof toReservation> }
  | { status: 404; code: "NOT_FOUND"; message: string }
  | { status: 409; code: "SOLD_OUT"; message: string };

export async function reserveSeat(
  db: Database.Database,
  input: ReservationInput,
): Promise<ReservationResult> {
  const event = getEvent(db, input.eventId);
  if (!event) {
    return { status: 404, code: "NOT_FOUND", message: "Workshop not found." };
  }
  if (event.available <= 0) {
    return {
      status: 409,
      code: "SOLD_OUT",
      message: "This workshop is fully booked.",
    };
  }

  // Simulates a provider round trip. No payment or email is sent in this demo.
  await setTimeout(80);

  const row: ReservationRow = {
    id: randomUUID(),
    event_id: input.eventId,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    request_id: input.requestId,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `
    INSERT INTO reservations
      (id, event_id, customer_name, customer_email, request_id, created_at)
    VALUES (@id, @event_id, @customer_name, @customer_email, @request_id, @created_at)
  `,
  ).run(row);
  return { status: 201, reservation: toReservation(row) };
}
