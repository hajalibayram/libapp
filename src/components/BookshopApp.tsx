"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Book,
  AppState,
  AppUser,
  InventoryTransaction,
  ScanMode,
  ScanResult,
  dashboardStats,
  exportInventoryCsv,
  findBookById,
  searchBooks
} from "@/lib/core";

type Route = "/" | "/scan/add" | "/scan/remove" | "/inventory" | "/activity" | "/export" | "/users" | `/books/${string}`;
type ScanApiResponse = ScanResult & {
  state: AppState;
  stats?: ReturnType<typeof dashboardStats>;
};
type BarcodeDetectionResult = {
  rawValue?: string;
};
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectionResult[]>;
};
type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
};
type BarcodeDetectorWindow = Window &
  typeof globalThis & {
    BarcodeDetector?: BarcodeDetectorConstructor;
  };

export function BookshopApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [route, setRoute] = useState<Route>("/");
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState("all");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [processingScan, setProcessingScan] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void bootstrapSession();

    const syncRoute = () => setRoute(parseRoute(window.location.hash));
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    if (route.startsWith("/scan/")) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [route, lastResult, processingScan]);

  function acceptServerState(nextState: AppState) {
    setState(nextState);
  }

  function login(user: AppUser) {
    setCurrentUser(user);
    void refreshState();
    navigate("/");
  }

  function logout() {
    void apiPost<{ status: string }>("/api/auth/logout").finally(() => {
      setCurrentUser(null);
      setLastResult(null);
      navigate("/");
    });
  }

  async function runScan(mode: ScanMode, value: string) {
    if (!state || !currentUser || processingScan || !value.trim()) {
      inputRef.current?.focus();
      return;
    }

    setProcessingScan(true);
    try {
      const response = await apiPost<ScanApiResponse>("/api/scan", { isbn: value, mode });
      setLastResult(toScanResult(response));
      acceptServerState(response.state);
    } finally {
      setProcessingScan(false);
    }
  }

  function runUndo(transactionId: string) {
    if (!state || !currentUser) return;
    void apiPost<ScanApiResponse>(`/api/transactions/${encodeURIComponent(transactionId)}/undo`).then((response) => {
      setLastResult(toScanResult(response));
      acceptServerState(response.state);
    });
  }

  async function runManualChange(book: Book, mode: ScanMode) {
    if (!state || !currentUser) return;
    const action = mode === "ADD" ? "add" : "remove";
    const response = await apiPost<ScanApiResponse>(`/api/books/${encodeURIComponent(book.id)}/${action}`);
    setLastResult(toScanResult(response));
    acceptServerState(response.state);
  }

  function downloadCsv() {
    if (!currentUser) return;
    const link = document.createElement("a");
    link.href = "/api/export/inventory.csv";
    link.download = "bookshop-inventory.csv";
    link.click();
  }

  async function refreshSession() {
    const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) {
      setCurrentUser(null);
      setAuthChecked(true);
      return null;
    }
    const body = (await response.json()) as { user: AppUser | null };
    setCurrentUser(body.user);
    setAuthChecked(true);
    return body.user;
  }

  async function bootstrapSession() {
    const user = await refreshSession();
    if (user) {
      await refreshState();
    }
  }

  async function refreshState() {
    const response = await fetch("/api/app/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load application state");
    const body = (await response.json()) as { state: AppState };
    acceptServerState(body.state);
  }

  async function apiPost<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {})
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  function toScanResult(response: ScanApiResponse): ScanResult {
    const { state: _state, stats: _stats, ...result } = response;
    return result as ScanResult;
  }

  if (!authChecked) return null;

  if (!currentUser) {
    return <Login onLogin={login} />;
  }

  if (!state) return null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Volunteer Bookshop</div>
        <div className="userbar">
          <span>
            {currentUser.name} · {currentUser.role}
          </span>
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <div className="layout">
        <nav className="nav">
          <NavLink route="/" label="Dashboard" activeRoute={route} />
          <NavLink route="/scan/add" label="Add Books" activeRoute={route} />
          <NavLink route="/scan/remove" label="Remove Books" activeRoute={route} />
          <NavLink route="/inventory" label="Inventory" activeRoute={route} />
          <NavLink route="/activity" label="Activity" activeRoute={route} />
          {currentUser.role === "ADMIN" ? <NavLink route="/export" label="Export" activeRoute={route} /> : null}
          {currentUser.role === "ADMIN" ? <NavLink route="/users" label="Users" activeRoute={route} /> : null}
        </nav>
        <main>
          {route === "/" ? (
            <Dashboard
              state={state}
              onSearch={(nextQuery) => {
                setQuery(nextQuery);
                navigate("/inventory");
              }}
            />
          ) : route === "/scan/add" ? (
            <ScanPage mode="ADD" inputRef={inputRef} lastResult={lastResult} processingScan={processingScan} onScan={runScan} onUndo={runUndo} />
          ) : route === "/scan/remove" ? (
            <ScanPage mode="REMOVE" inputRef={inputRef} lastResult={lastResult} processingScan={processingScan} onScan={runScan} onUndo={runUndo} />
          ) : route === "/inventory" ? (
            <InventoryPage state={state} query={query} stock={stock} onQuery={setQuery} onStock={setStock} />
          ) : route.startsWith("/books/") ? (
            <BookDetailPage state={state} bookId={decodeURIComponent(route.slice("/books/".length))} onManualChange={runManualChange} />
          ) : route === "/activity" ? (
            <ActivityPage state={state} />
          ) : route === "/export" && currentUser.role === "ADMIN" ? (
            <ExportPage state={state} onDownload={downloadCsv} />
          ) : route === "/users" && currentUser.role === "ADMIN" ? (
            <UsersPage state={state} />
          ) : (
            <Forbidden />
          )}
        </main>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password })
      });

      const body = (await response.json().catch(() => ({}))) as { user?: AppUser; status?: string };

      if (!response.ok || !body.user) {
        setError(loginErrorMessage(body.status));
        return;
      }

      onLogin(body.user);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <section className="login-panel">
        <h1>Volunteer Bookshop</h1>
        <p className="muted">Log in with the email and password created in Supabase Auth.</p>
        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" placeholder="volunteer@bookshop.test" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "Logging in" : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function loginErrorMessage(status: string | undefined): string {
  if (status === "MISSING_CREDENTIALS") return "Enter an email and password.";
  if (status === "PROFILE_NOT_ACTIVE") return "This user does not have an active bookshop profile.";
  if (status === "INVALID_LOGIN") return "Email or password is incorrect.";
  return "Login failed. Check the Supabase user and profile setup.";
}

function Dashboard({ state, onSearch }: { state: AppState; onSearch: (query: string) => void }) {
  const stats = dashboardStats(state);
  const recent = state.transactions.slice(0, 5);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSearch(String(formData.get("query") || ""));
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Volunteer Bookshop</h1>
          <p className="muted">Scan ISBN barcodes, search stock, and review recent inventory changes.</p>
        </div>
      </div>
      <div className="hero-actions">
        <a className="add-action" href="#/scan/add">
          <span>Add Books</span>
          <span>+</span>
        </a>
        <a className="remove-action" href="#/scan/remove">
          <span>Remove Books</span>
          <span>-</span>
        </a>
      </div>
      <div className="grid three stats-row">
        <StatCard label="Total titles" value={stats.totalTitles} />
        <StatCard label="Total books" value={stats.totalBooks} />
        <StatCard label="Out of stock" value={stats.outOfStock} />
      </div>
      <section className="panel spaced">
        <h2>Search Inventory</h2>
        <form className="scan-form" onSubmit={handleSearch}>
          <input name="query" placeholder="Title, author, or ISBN" autoComplete="off" />
          <button type="submit">Search</button>
        </form>
      </section>
      <section className="panel spaced">
        <h2>Recent Activity</h2>
        {recent.length ? <ActivityTable state={state} transactions={recent} /> : <div className="empty">No inventory transactions yet.</div>}
      </section>
    </section>
  );
}

function ScanPage({
  mode,
  inputRef,
  lastResult,
  processingScan,
  onScan,
  onUndo
}: {
  mode: ScanMode;
  inputRef: React.RefObject<HTMLInputElement | null>;
  lastResult: ScanResult | null;
  processingScan: boolean;
  onScan: (mode: ScanMode, value: string) => Promise<void>;
  onUndo: (transactionId: string) => void;
}) {
  const isAdd = mode === "ADD";
  const [cameraOpen, setCameraOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("isbn") as HTMLInputElement;
    const value = input.value;
    input.value = "";
    await onScan(mode, value);
  }

  return (
    <section className={`page panel scan-page ${isAdd ? "add" : "remove"}`}>
      <div className="page-header">
        <div>
          <h1>{isAdd ? "Add Books" : "Remove Books"}</h1>
          <p className="muted">{isAdd ? "Scan a book ISBN to add one copy." : "Scan a local inventory ISBN to remove one copy."}</p>
        </div>
        <span className={`qty ${isAdd ? "in" : "out"}`}>{mode}</span>
      </div>
      <form className="scan-form" autoComplete="off" onSubmit={handleSubmit}>
        <input ref={inputRef} name="isbn" inputMode="search" placeholder="Scan or enter ISBN" disabled={processingScan} />
        <button type="submit" disabled={processingScan}>
          {processingScan ? "Processing" : "Submit"}
        </button>
      </form>
      <div className="scan-tools">
        <button type="button" className="secondary" onClick={() => setCameraOpen((open) => !open)} disabled={processingScan}>
          {cameraOpen ? "Close camera" : "Scan with camera"}
        </button>
      </div>
      {cameraOpen ? <CameraScanner mode={mode} processingScan={processingScan} onScan={onScan} /> : null}
      <ScanResultView result={lastResult} onUndo={onUndo} />
    </section>
  );
}

function CameraScanner({
  mode,
  processingScan,
  onScan
}: {
  mode: ScanMode;
  processingScan: boolean;
  onScan: (mode: ScanMode, value: string) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ value: string; time: number } | null>(null);
  const detectBusyRef = useRef(false);
  const onScanRef = useRef(onScan);
  const processingRef = useRef(processingScan);
  const [status, setStatus] = useState("Starting camera...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    processingRef.current = processingScan;
  }, [processingScan]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const barcodeWindow = window as BarcodeDetectorWindow;
        if (!barcodeWindow.BarcodeDetector) {
          setError("Camera barcode scanning is not supported by this browser. Use manual entry or a USB scanner.");
          return;
        }

        const supportedFormats = barcodeWindow.BarcodeDetector.getSupportedFormats ? await barcodeWindow.BarcodeDetector.getSupportedFormats() : [];
        const requestedFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
        const formats = supportedFormats.length ? requestedFormats.filter((format) => supportedFormats.includes(format)) : requestedFormats;

        if (supportedFormats.length && !formats.includes("ean_13")) {
          setError("This browser camera scanner does not support EAN-13 book barcodes.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" }
          }
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        streamRef.current = stream;
        detectorRef.current = new barcodeWindow.BarcodeDetector({ formats });
        video.srcObject = stream;
        await video.play();
        setStatus("Point the camera at the ISBN barcode.");
        scanFrame();
      } catch {
        setError("Camera access failed. Check browser permissions, then try again.");
      }
    }

    function scanFrame() {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector) return;

      animationRef.current = window.requestAnimationFrame(scanFrame);

      if (detectBusyRef.current || processingRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      detectBusyRef.current = true;
      void detector
        .detect(video)
        .then((barcodes) => {
          const value = barcodes.find((barcode) => barcode.rawValue)?.rawValue?.trim();
          if (!value) return;

          const now = Date.now();
          const previous = lastScanRef.current;
          if (previous?.value === value && now - previous.time < 1800) return;

          lastScanRef.current = { value, time: now };
          setStatus(`Detected ${value}`);
          void onScanRef.current(mode, value);
        })
        .catch(() => {
          setStatus("Keep the barcode steady in the frame.");
        })
        .finally(() => {
          detectBusyRef.current = false;
        });
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [mode]);

  return (
    <div className="camera-panel">
      <div className="camera-frame">
        <video ref={videoRef} muted playsInline autoPlay />
        <div className="camera-guide" aria-hidden="true" />
      </div>
      <p className={error ? "camera-status error" : "camera-status"}>{error || status}</p>
    </div>
  );
}

function ScanResultView({ result, onUndo }: { result: ScanResult | null; onUndo: (transactionId: string) => void }) {
  if (!result) {
    return (
      <div className="scan-result result-info">
        <div className="result-title">Ready for next scan</div>
        <p className="muted">The input keeps focus after every scan. A USB scanner that sends Enter should submit automatically.</p>
      </div>
    );
  }

  if (result.status === "SUCCESS") {
    const actionLabel = result.action === "REMOVE" ? "Removed" : result.action === "UNDO" ? "Undo complete" : "Added";
    return (
      <div className="scan-result result-success">
        <div className="result-title">{actionLabel}</div>
        <div className="book-result">
          <Cover book={result.book} />
          <div>
            <h2>{result.book.title}</h2>
            <p>{result.book.authors.join(", ")}</p>
            <p className="muted">ISBN {result.book.isbn13 || result.book.isbn10}</p>
            <p>
              <strong>
                Stock {result.inventory.before} -&gt; {result.inventory.after}
              </strong>
            </p>
          </div>
        </div>
        {result.action !== "UNDO" ? (
          <div className="actions">
            <button className="secondary" onClick={() => onUndo(result.transactionId)}>
              Undo
            </button>
          </div>
        ) : null}
        <p className="muted result-ready">Ready for next scan...</p>
      </div>
    );
  }

  const message =
    {
      INVALID_ISBN: "Invalid ISBN",
      NOT_FOUND: "Book not found",
      LOOKUP_FAILED: "Lookup failed",
      NOT_IN_INVENTORY: "Book not in inventory",
      OUT_OF_STOCK: "Already out of stock",
      CANNOT_UNDO: "Cannot undo",
      ALREADY_UNDONE: "Already undone"
    }[result.status] || "Inventory service unavailable";

  return (
    <div className={`scan-result ${result.status === "OUT_OF_STOCK" ? "result-info" : "result-error"}`}>
      <div className="result-title">{message}</div>
      {result.book ? <p>{result.book.title}</p> : null}
      {result.isbn ? <p className="muted">ISBN {result.isbn}</p> : null}
      <p className="muted">Ready for next scan...</p>
    </div>
  );
}

function InventoryPage({
  state,
  query,
  stock,
  onQuery,
  onStock
}: {
  state: AppState;
  query: string;
  stock: string;
  onQuery: (query: string) => void;
  onStock: (stock: string) => void;
}) {
  const books = useMemo(() => searchBooks(state, query, stock), [query, state, stock]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p className="muted">Search by title, author, ISBN-10, or ISBN-13.</p>
        </div>
      </div>
      <form className="toolbar">
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Title, author, or ISBN" autoComplete="off" />
        <select value={stock} onChange={(event) => onStock(event.target.value)}>
          <option value="all">All</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </select>
      </form>
      <section className="panel table-panel">{books.length ? <BookTable books={books} /> : <div className="empty">No books match this search.</div>}</section>
    </section>
  );
}

function BookDetailPage({
  state,
  bookId,
  onManualChange
}: {
  state: AppState;
  bookId: string;
  onManualChange: (book: Book, mode: ScanMode) => Promise<void>;
}) {
  const book = findBookById(state, bookId);
  if (!book) {
    return (
      <section className="page panel">
        <h1>Book not found</h1>
      </section>
    );
  }

  const activity = state.transactions.filter((transaction) => transaction.bookId === book.id).slice(0, 8);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{book.title}</h1>
          <p className="muted">{book.authors.join(", ")}</p>
        </div>
        <a href="#/inventory">
          <button className="secondary">Back</button>
        </a>
      </div>
      <section className="panel detail">
        <Cover book={book} />
        <div>
          <div className="meta">
            <strong>ISBN-13</strong>
            <span>{book.isbn13}</span>
            <strong>ISBN-10</strong>
            <span>{book.isbn10}</span>
            <strong>Publisher</strong>
            <span>{book.publisher}</span>
            <strong>Publication date</strong>
            <span>{book.publicationDate}</span>
            <strong>Language</strong>
            <span>{book.language}</span>
            <strong>Stock</strong>
            <span>
              <span className={`qty ${book.quantity > 0 ? "in" : "out"}`}>{book.quantity}</span>
            </span>
          </div>
          <p className="description">{book.description}</p>
          <div className="actions">
            <button onClick={() => onManualChange(book, "ADD")}>+ Add copy</button>
            <button className="danger" onClick={() => onManualChange(book, "REMOVE")}>
              - Remove copy
            </button>
          </div>
        </div>
      </section>
      <section className="panel spaced">
        <h2>Recent Activity</h2>
        {activity.length ? <ActivityTable state={state} transactions={activity} /> : <div className="empty">No transactions for this book yet.</div>}
      </section>
    </section>
  );
}

function ActivityPage({ state }: { state: AppState }) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Activity</h1>
          <p className="muted">Successful inventory changes only. Failed scans are not inventory transactions.</p>
        </div>
      </div>
      <section className="panel">
        {state.transactions.length ? <ActivityTable state={state} transactions={state.transactions} /> : <div className="empty">No inventory transactions yet.</div>}
      </section>
    </section>
  );
}

function ExportPage({ state, onDownload }: { state: AppState; onDownload: () => void }) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Export</h1>
          <p className="muted">Admin-only CSV export of current inventory.</p>
        </div>
        <button onClick={onDownload}>Download CSV</button>
      </div>
      <div className="notice">The export contains ISBN, title, authors, available metadata, and quantity. It contains no price or shelf/location fields.</div>
      <section className="panel">
        <pre>{exportInventoryCsv(state)}</pre>
      </section>
    </section>
  );
}

function UsersPage({ state }: { state: AppState }) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="muted">User access is managed through Supabase Auth and profiles.</p>
        </div>
      </div>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function Forbidden() {
  return (
    <section className="page panel">
      <h1>Admin only</h1>
      <p className="muted">Log in with an admin account to use this page.</p>
    </section>
  );
}

function BookTable({ books }: { books: Book[] }) {
  return (
    <table className="inventory-table">
      <thead>
        <tr>
          <th>Cover</th>
          <th>Title</th>
          <th>Author</th>
          <th>ISBN</th>
          <th>Quantity</th>
        </tr>
      </thead>
      <tbody>
        {books.map((book) => (
          <tr className="clickable" key={book.id} onClick={() => navigate(`/books/${encodeURIComponent(book.id)}`)}>
            <td className="cover-cell">
              <Cover book={book} variant="compact" />
            </td>
            <td className="title-cell">
              <strong className="book-title">{book.title}</strong>
              <br />
              <span className="book-subtitle">{book.publisher || "Unknown publisher"}</span>
            </td>
            <td className="text-cell">{book.authors.join(", ")}</td>
            <td className="isbn-cell">{book.isbn13 || book.isbn10}</td>
            <td>
              <span className={`qty ${book.quantity > 0 ? "in" : "out"}`}>{book.quantity}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActivityTable({ state, transactions }: { state: AppState; transactions: InventoryTransaction[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Book</th>
          <th>Action</th>
          <th>Before</th>
          <th>After</th>
          <th>User</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((transaction) => {
          const book = findBookById(state, transaction.bookId);
          return (
            <tr key={transaction.id}>
              <td>{formatDate(transaction.createdAt)}</td>
              <td>{book?.title || "Unknown book"}</td>
              <td>{transaction.action}</td>
              <td>{transaction.quantityBefore}</td>
              <td>{transaction.quantityAfter}</td>
              <td>{transaction.userName}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function Cover({ book, variant }: { book: Pick<Book, "coverUrl" | "title"> | { coverUrl: string | null; title: string }; variant?: "compact" }) {
  const className = variant === "compact" ? "cover cover-compact" : "cover";
  if (book.coverUrl) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={book.coverUrl} alt={`Cover of ${book.title}`} loading="lazy" />
      </div>
    );
  }
  return <div className={className}>No cover</div>;
}

function NavLink({ route, label, activeRoute }: { route: Route; label: string; activeRoute: Route }) {
  return (
    <a href={`#${route}`} className={activeRoute === route ? "active" : ""}>
      {label}
    </a>
  );
}

function navigate(nextRoute: Route) {
  window.location.hash = nextRoute;
}

function parseRoute(hash: string): Route {
  const route = hash.replace(/^#/, "") || "/";
  if (route === "/" || route === "/scan/add" || route === "/scan/remove" || route === "/inventory" || route === "/activity" || route === "/export" || route === "/users") {
    return route;
  }
  if (route.startsWith("/books/")) return route as Route;
  return "/";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
