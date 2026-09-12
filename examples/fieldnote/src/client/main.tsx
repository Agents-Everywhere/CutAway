import { useEffect, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { connectToCutaway, type ConnectorConfig } from "./connector";
import "./styles.css";

interface Workshop {
  id: string;
  title: string;
  capacity: number;
  reserved: number;
  available: number;
}
interface Reservation {
  id: string;
  customerName: string;
  createdAt: string;
}
const eventId = "pottery-saturday";
const eventUrl = `/api/events/${eventId}`;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Fieldnote could not load this workshop.");
  return response.json() as Promise<T>;
}

function PotteryIllustration() {
  return (
    <svg
      className="pottery-art"
      viewBox="0 0 640 350"
      role="img"
      aria-label="Illustration of handmade terracotta pots in a sunlit studio"
    >
      <defs>
        <linearGradient id="clay" x1="0" x2="1">
          <stop stopColor="#A36546" />
          <stop offset=".45" stopColor="#CF9672" />
          <stop offset="1" stopColor="#B37854" />
        </linearGradient>
        <linearGradient id="bowl" x1="0" x2="1">
          <stop stopColor="#C39D79" />
          <stop offset=".5" stopColor="#E0C4A2" />
          <stop offset="1" stopColor="#B58C67" />
        </linearGradient>
      </defs>
      <rect width="640" height="350" fill="#E8DFCF" />
      <path d="M450 0H640V270H540Q465 185 450 0" fill="#F4EBDD" />
      <path d="M0 274C155 262 411 286 640 260V350H0Z" fill="#D4C1A5" />
      <ellipse
        cx="310"
        cy="302"
        rx="218"
        ry="19"
        fill="#B8A388"
        opacity=".35"
      />
      <path
        d="M270 101L271 142C250 160 223 181 228 231L239 276Q288 298 342 276L351 230C357 178 327 159 309 142L310 101Z"
        fill="url(#clay)"
      />
      <ellipse cx="290" cy="102" rx="20" ry="7" fill="#E4B190" />
      <ellipse cx="290" cy="103" rx="14" ry="4" fill="#805D42" />
      <path
        d="M243 187Q288 197 338 184M232 207Q290 219 349 205M234 228Q290 240 346 226M238 249Q290 261 342 247"
        stroke="#A66949"
        strokeWidth="2"
        opacity=".4"
        fill="none"
      />
      <path d="M374 220Q380 290 439 294Q495 291 503 220Z" fill="url(#bowl)" />
      <ellipse cx="438" cy="220" rx="65" ry="18" fill="#E7D1B5" />
      <ellipse cx="438" cy="220" rx="54" ry="12" fill="#A98564" />
      <path d="M130 207L132 265Q164 291 192 265L194 207Z" fill="#EEDEBD" />
      <ellipse cx="162" cy="207" rx="32" ry="9" fill="#F7E8CB" />
      <ellipse cx="162" cy="207" rx="25" ry="5" fill="#BFA781" />
      <path
        d="M194 220C225 211 226 255 192 249"
        fill="none"
        stroke="#EEDEBD"
        strokeWidth="11"
      />
      <path
        d="M554 265L544 131M544 159Q508 155 513 125Q540 129 544 159M548 191Q579 172 577 149Q548 156 548 191M550 223Q521 216 521 189Q547 195 550 223"
        fill="#727B58"
        stroke="#727B58"
        strokeWidth="3"
      />
      <path d="M519 251H584L576 297H529Z" fill="#A37956" />
    </svg>
  );
}

function App() {
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [config, setConfig] = useState<ConnectorConfig | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const connector = useRef<ReturnType<typeof connectToCutaway> | null>(null);
  const parameters = new URLSearchParams(location.search);
  const preview = parameters.get("surface") === "preview";
  // The host shows this affordance only for operator sessions; APIs enforce access.
  const cutawayAvailable = Boolean(parameters.get("runId")?.trim());

  async function refresh() {
    const [event, list] = await Promise.all([
      getJson<Workshop>(eventUrl),
      getJson<{ reservations: Reservation[] }>(`${eventUrl}/reservations`),
    ]);
    setWorkshop(event);
    setReservations(list.reservations);
  }
  useEffect(() => {
    void Promise.all([
      refresh(),
      getJson<ConnectorConfig>("/api/config").then(setConfig),
    ]).catch((error: unknown) => {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not load the workshop.",
      });
    });
  }, []);
  useEffect(() => {
    if (!config || !workshop) return;
    connector.current = connectToCutaway(config);
    return () => {
      connector.current?.disconnect();
      connector.current = null;
    };
  }, [config, Boolean(workshop)]);

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBooking(true);
    setNotice(null);
    try {
      const response = await fetch(`${eventUrl}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          requestId: crypto.randomUUID(),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(
          result.message ?? "Your reservation could not be completed.",
        );
      setNotice({
        kind: "success",
        text: `You're on the list, ${name.split(" ")[0]}. See you in the studio.`,
      });
      setName("");
      setEmail("");
      await refresh();
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Your reservation could not be completed.",
      });
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="site">
      <header className="site-header">
        <a
          className="brand"
          href={`/workshops/pottery-saturday${location.search}`}
          aria-label="Fieldnote Studio home"
        >
          <span className="brand-mark">f.</span>
          <span>
            fieldnote<span className="brand-subtitle">STUDIO & WORKSHOPS</span>
          </span>
        </a>
        <div className="header-right">
          <span className="location">Made together, in Toronto</span>
          {cutawayAvailable && (
            <button
              className="cutaway-open"
              onClick={() => connector.current?.open()}
              aria-label="Open Cutaway assistant"
            >
              ✦
            </button>
          )}
        </div>
      </header>
      {preview && (
        <div className="preview-notice">
          Candidate preview · Bookings here use a separate copy of demo data.
        </div>
      )}
      <main>
        <div className="breadcrumb">
          THE STUDIO <span>/</span> WORKSHOPS
        </div>
        <div className="workshop-layout">
          <section className="workshop-story">
            <div className="eyebrow">
              <span className="small-line" /> MAKE SOMETHING SLOWLY
            </div>
            <h1>
              Good company.
              <br />
              <em>A little clay.</em>
            </h1>
            <p className="intro">
              An afternoon to get your hands into something real. Join our small
              table for a relaxed introduction to hand-built pottery.
            </p>
            <div className="art-frame">
              <PotteryIllustration />
              <span className="art-caption">
                A FEW HOURS OFFLINE. SOMETHING TO KEEP.
              </span>
            </div>
            <div className="story-details">
              <div>
                <span className="detail-icon">↗</span>
                <h3>Come as you are</h3>
                <p>
                  First-timers welcome. We'll guide every pinch, coil and curve.
                </p>
              </div>
              <div>
                <span className="detail-icon">◎</span>
                <h3>Everything included</h3>
                <p>
                  Clay, tools, glazing and firing. Just bring your curiosity.
                </p>
              </div>
            </div>
          </section>
          <aside
            className="booking-card"
            aria-label="Book Saturday pottery workshop"
          >
            <div className="card-eyebrow">SMALL GROUP · HAND BUILDING</div>
            <h2>
              Saturday pottery
              <br />
              workshop
            </h2>
            <div className="workshop-meta">
              <div>
                <span>DATE</span>
                <strong>Saturday, September 19</strong>
              </div>
              <div>
                <span>TIME</span>
                <strong>2:00–4:30 p.m.</strong>
              </div>
              <div>
                <span>PLACE</span>
                <strong>Fieldnote Studio, Toronto</strong>
              </div>
            </div>
            <div className="availability" data-cutaway-id="booking.capacity">
              <span
                className={`availability-dot ${workshop && workshop.available <= 0 ? "full" : ""}`}
              />
              <strong>
                {workshop
                  ? `${Math.max(0, workshop.available)} ${workshop.available === 1 ? "place" : "places"} remaining`
                  : "Loading availability…"}
              </strong>
              <span>
                {workshop
                  ? `${workshop.reserved} of ${workshop.capacity} booked`
                  : "—"}
              </span>
            </div>
            <form
              onSubmit={(event) => void book(event)}
              data-cutaway-id="booking.submit"
            >
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                name="name"
                placeholder="Avery Park"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={120}
              />
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="avery@example.test"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
              />
              <button
                className="book-button"
                disabled={booking || !workshop || workshop.available <= 0}
              >
                {booking
                  ? "Saving your place…"
                  : workshop && workshop.available <= 0
                    ? "Workshop fully booked"
                    : "Save my place"}
                <span>↗</span>
              </button>
              <p className="form-note">
                Synthetic demo · no payment or email is sent.
              </p>
            </form>
            {notice && (
              <p className={`notice ${notice.kind}`} role="status">
                {notice.text}
              </p>
            )}
            <div
              className="reservations"
              data-cutaway-id="booking.reservations"
            >
              <div className="reservation-heading">
                <h3>At the table</h3>
                <span>{reservations.length}</span>
              </div>
              {reservations.map((reservation) => (
                <div className="reservation" key={reservation.id}>
                  <span className="avatar">
                    {reservation.customerName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <strong>{reservation.customerName}</strong>
                    <span>Confirmed reservation</span>
                  </div>
                  <span className="confirmed" aria-label="Confirmed">
                    ✓
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
      <footer>
        <span>Less scrolling. More making.</span>
        <span>FIELDNOTE STUDIO · EST. 2026</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
