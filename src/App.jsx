import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  API_BASE_URL,
  activateUser,
  createAuthenticationToken,
  createMovie,
  deleteMovie,
  extractErrorMessage,
  getHealthcheck,
  getMovie,
  listMovies,
  registerUser,
  updateMovie,
} from "./lib/api.js";
import stormlightHeroImage from "./assets/stormlight-hero.jpg";

const TOKEN_STORAGE_KEY = "scadrialapi.auth.token";
const SESSION_STORAGE_KEY = "scadrialapi.session";
const DEFAULT_PAGE_SIZE = 6;
const AppStateContext = createContext(null);

const initialAuthForm = { email: "", password: "" };
const initialRegisterForm = { name: "", email: "", password: "" };
const initialActivationForm = { token: "" };
const initialMovieForm = { title: "", year: "", runtime: "", genres: "" };

const sortOptions = [
  { value: "id", label: "Newest added" },
  { value: "-id", label: "Oldest added" },
  { value: "title", label: "Title A-Z" },
  { value: "-title", label: "Title Z-A" },
  { value: "year", label: "Year ascending" },
  { value: "-year", label: "Year descending" },
  { value: "runtime", label: "Runtime ascending" },
  { value: "-runtime", label: "Runtime descending" },
];

function loadStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function loadStoredSession() {
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(token, session) {
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  if (session) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function splitGenres(input) {
  return input
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function movieToForm(movie) {
  return {
    title: movie.title || "",
    year: movie.year ? String(movie.year) : "",
    runtime:
      typeof movie.runtime === "string"
        ? movie.runtime.replace(" mins", "")
        : "",
    genres: Array.isArray(movie.genres) ? movie.genres.join(", ") : "",
  };
}

function buildMoviePayload(form) {
  return {
    title: form.title.trim(),
    year: Number(form.year),
    runtime: `${Number(form.runtime)} mins`,
    genres: splitGenres(form.genres),
  };
}

function formatApiError(error) {
  return (
    extractErrorMessage(error?.payload) ||
    error?.message ||
    "Something went wrong."
  );
}

function formatRuntime(runtime) {
  if (typeof runtime === "string") {
    return runtime;
  }
  return `${runtime} mins`;
}

function formatGenres(genres) {
  return Array.isArray(genres) ? genres.join(" • ") : "";
}

function getMetadataLabel(metadata) {
  if (!metadata) {
    return "No pagination metadata yet";
  }

  return `${metadata.total_records} records • page ${metadata.current_page} of ${metadata.last_page}`;
}

function pageTitle(pathname) {
  if (pathname === "/") return "Landing";
  if (pathname === "/login") return "Login";
  if (pathname === "/register") return "Register";
  if (pathname === "/activate") return "Activate";
  if (pathname === "/movies") return "Movies";
  if (pathname === "/movies/new") return "Create";
  if (pathname.endsWith("/edit")) return "Edit";
  if (pathname.startsWith("/movies/")) return "Detail";
  return "ScadrialAPI";
}

function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateContext");
  }

  return context;
}

export default function App() {
  const [token, setToken] = useState(() => loadStoredToken());
  const [session, setSession] = useState(() => loadStoredSession());
  const [health, setHealth] = useState({
    loading: true,
    error: "",
    data: null,
  });
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadHealth() {
      setHealth({ loading: true, error: "", data: null });
      try {
        const payload = await getHealthcheck();
        if (!ignore) {
          setHealth({ loading: false, error: "", data: payload });
        }
      } catch (error) {
        if (!ignore) {
          setHealth({
            loading: false,
            error: formatApiError(error),
            data: null,
          });
        }
      }
    }

    loadHealth();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    saveSession(token, session);
  }, [token, session]);

  const appState = useMemo(
    () => ({
      token,
      setToken,
      session,
      setSession,
      health,
      notice,
      setNotice,
      errorMessage,
      setErrorMessage,
      refreshKey,
      bumpRefreshKey: () => setRefreshKey((current) => current + 1),
      clearMessages: () => {
        setNotice("");
        setErrorMessage("");
      },
      logout: () => {
        setToken("");
        setSession(null);
        setNotice("");
        setErrorMessage("");
      },
      isAuthenticated: Boolean(token),
    }),
    [token, session, health, notice, errorMessage, refreshKey],
  );

  return (
    <AppStateContext.Provider value={appState}>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/activate" element={<ActivatePage />} />
            <Route
              path="/movies"
              element={
                <ProtectedRoute>
                  <MoviesIndexPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/movies/new"
              element={
                <ProtectedRoute>
                  <MovieFormPage mode="create" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/movies/:movieId"
              element={
                <ProtectedRoute>
                  <MovieDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/movies/:movieId/edit"
              element={
                <ProtectedRoute>
                  <MovieFormPage mode="edit" />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppStateContext.Provider>
  );
}

function AppShell({ children }) {
  const appState = useAppState();
  const location = useLocation();

  return (
    <div className="site-shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <div className="grain-overlay" />
      <header className="site-header">
        <Link to="/" className="brand-mark">
          <span className="brand-kicker">ScadrialAPI</span>
          <span className="brand-name">Stormlit Index</span>
        </Link>
        <nav className="site-nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/register">Register</NavLink>
          <NavLink to="/activate">Activate</NavLink>
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/movies">Movies</NavLink>
        </nav>
        <div className="site-actions">
          <span className="header-badge">{pageTitle(location.pathname)}</span>
          {appState.isAuthenticated ? (
            <button className="button button-ghost" onClick={appState.logout}>
              Logout
            </button>
          ) : (
            <Link to="/login" className="button button-primary">
              Enter app
            </Link>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function ProtectedRoute({ children }) {
  const appState = useAppState();
  const location = useLocation();

  if (!appState.isAuthenticated) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return children;
}

function LandingPage() {
  const appState = useAppState();

  return (
    <main className="layout-stack">
      <section className="hero-breakout">
        <div className="hero-grid hero-grid-overhauled">
          <div className="hero-copy hero-copy-overhauled">
            <div className="hero-copy-top">
              <p className="eyebrow hero-eyebrow">
                Storm-forged frontend for ScadrialAPI
              </p>
              <div className="hero-chip-row">
                <span className="hero-chip">#13262F</span>
                <span className="hero-chip">#583E23</span>
                <span className="hero-chip">#73683B</span>
              </div>
            </div>
            <div className="hero-copy-main">
              <h1>Carry the archive through the storm.</h1>
              <p className="lede hero-lede">
                A darker, richer landing experience shaped around your new
                palette, with a full-width cinematic hero, Stormlight-inspired
                artwork, and dedicated routes for every major part of the
                product.
              </p>
              <div className="hero-cta">
                <Link to="/register" className="button button-primary">
                  Begin the oaths
                </Link>
                <Link to="/movies" className="button button-ghost">
                  Enter the archive
                </Link>
              </div>
            </div>
            <div className="hero-inline-stats">
              <div className="hero-inline-stat">
                <span>Backend</span>
                <strong>{appState.health.error ? "Offline" : "Available"}</strong>
              </div>
              <div className="hero-inline-stat">
                <span>Environment</span>
                <strong>
                  {appState.health.data?.system_info?.environment || "Unknown"}
                </strong>
              </div>
              <div className="hero-inline-stat">
                <span>API base</span>
                <strong>{API_BASE_URL.replace(/^https?:\/\//, "")}</strong>
              </div>
            </div>
          </div>

          <div className="hero-visual hero-visual-overhauled">
            <div className="hero-image-wrap">
              <img
                className="hero-image"
                src={stormlightHeroImage}
                alt="Stormlight-inspired landscape with a luminous blade and highstorm winds"
              />
              <div className="hero-image-sheen" />
            </div>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <article className="feature-block feature-block-one">
          <p className="eyebrow">Route-based product</p>
          <h2>Each page has its own path now.</h2>
          <p className="body-copy">
            The landing page, registration, activation, login, movie index,
            movie detail, and edit flow all live on dedicated routes instead of
            being stacked into one prototype screen.
          </p>
        </article>
        <article className="feature-block feature-block-two">
          <p className="eyebrow">Stormlight mood</p>
          <h2>Shattered plains, stormlight, and quiet motion.</h2>
          <p className="body-copy">
            The visual language leans into windswept stone, luminous energy, and
            restrained typography instead of generic dashboard chrome.
          </p>
        </article>
        <article className="feature-block feature-block-three">
          <p className="eyebrow">Go backend intact</p>
          <h2>No Go code was changed.</h2>
          <p className="body-copy">
            The frontend still talks directly to your existing endpoints for
            health, auth, user activation, and protected movie CRUD.
          </p>
        </article>
      </section>

      <section className="quote-strip panel">
        <p className="quote">
          “Journey before destination” becomes product direction here: the first
          impression is now a real homepage, and the operational flows live in
          their own clearly marked paths.
        </p>
      </section>
    </main>
  );
}

function LoginPage() {
  const appState = useAppState();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(initialAuthForm);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    appState.clearMessages();
    setBusy(true);

    try {
      const payload = await createAuthenticationToken(form);
      appState.setToken(payload.authentication_token?.plaintext || "");
      appState.setSession({
        email: form.email,
        authenticatedAt: new Date().toISOString(),
      });
      appState.setNotice(
        "Authenticated. If the account has been activated, the movie archive is ready.",
      );
      navigate(searchParams.get("next") || "/movies");
    } catch (error) {
      appState.setErrorMessage(formatApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Login"
      title="Enter the archive"
      description="Authenticate against the Go API and store the bearer token locally for this v1 frontend."
      footerLink={{ to: "/activate", label: "Need to activate first?" }}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="bridgefour@urithiru.dev"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="At least 8 characters"
            required
          />
        </label>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Authenticating..." : "Login"}
        </button>
      </form>
    </AuthPageFrame>
  );
}

function RegisterPage() {
  const appState = useAppState();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialRegisterForm);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    appState.clearMessages();
    setBusy(true);

    try {
      const payload = await registerUser(form);
      appState.setSession({
        name: payload.user?.name || form.name,
        email: payload.user?.email || form.email,
        registeredAt: new Date().toISOString(),
      });
      appState.setNotice(
        "Account created. Your activation token should arrive through the backend mail flow.",
      );
      navigate("/activate");
    } catch (error) {
      appState.setErrorMessage(formatApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Registration"
      title="Speak the first ideal"
      description="Create a user account that can later authenticate and access the protected movie archive."
      footerLink={{ to: "/login", label: "Already have an account?" }}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Kaladin Stormblessed"
            required
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="windrunner@urithiru.dev"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Set a secure password"
            required
          />
        </label>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Creating account..." : "Register"}
        </button>
      </form>
    </AuthPageFrame>
  );
}

function ActivatePage() {
  const appState = useAppState();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialActivationForm);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    appState.clearMessages();
    setBusy(true);

    try {
      const payload = await activateUser(form.token);
      appState.setSession((current) => ({
        ...(current || {}),
        email: payload.user?.email || current?.email,
        activated: true,
        activatedAt: new Date().toISOString(),
      }));
      appState.setNotice(
        "Activation complete. You can sign in and access the protected routes now.",
      );
      navigate("/login");
    } catch (error) {
      appState.setErrorMessage(formatApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Activation"
      title="Infuse the account with stormlight"
      description="Paste the activation token delivered by the backend mailer to unlock the movie endpoints."
      footerLink={{ to: "/register", label: "Need a new account?" }}
    >
      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          <span>Activation token</span>
          <input
            type="text"
            value={form.token}
            onChange={(event) => setForm({ token: event.target.value })}
            placeholder="Paste the token from email"
            required
          />
        </label>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Activating..." : "Activate"}
        </button>
      </form>
    </AuthPageFrame>
  );
}

function AuthPageFrame({ eyebrow, title, description, footerLink, children }) {
  return (
    <main className="auth-layout">
      <section className="panel auth-panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="auth-title">{title}</h1>
        <p className="body-copy auth-copy">{description}</p>
        <StatusMessages />
        {children}
        <Link to={footerLink.to} className="inline-link">
          {footerLink.label}
        </Link>
      </section>
      <section className="panel auth-aside">
        <p className="eyebrow">Sequence</p>
        <h2>Register, activate, authenticate.</h2>
        <p className="body-copy">
          The app mirrors your API lifecycle instead of hiding it. Each action
          exists on its own route to keep onboarding clear and predictable.
        </p>
        <ul className="plain-list">
          <li>`/register` creates a user</li>
          <li>`/activate` validates the email token</li>
          <li>`/login` requests the bearer token</li>
          <li>`/movies/*` handles the protected catalog</li>
        </ul>
      </section>
    </main>
  );
}

function MoviesIndexPage() {
  const appState = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || "1");
  const title = searchParams.get("title") || "";
  const genres = searchParams.get("genres") || "";
  const sort = searchParams.get("sort") || "id";
  const pageSize = Number(
    searchParams.get("page_size") || String(DEFAULT_PAGE_SIZE),
  );
  const [state, setState] = useState({
    loading: true,
    error: "",
    movies: [],
    metadata: null,
  });

  useEffect(() => {
    let ignore = false;

    async function loadMovies() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const payload = await listMovies({
          token: appState.token,
          title,
          genres,
          sort,
          page,
          pageSize,
        });

        if (!ignore) {
          setState({
            loading: false,
            error: "",
            movies: payload.movies || [],
            metadata: payload.metadata || null,
          });
        }
      } catch (error) {
        if (!ignore) {
          setState({
            loading: false,
            error: formatApiError(error),
            movies: [],
            metadata: null,
          });
          if (error.status === 401) {
            appState.logout();
          }
        }
      }
    }

    loadMovies();
    return () => {
      ignore = true;
    };
  }, [
    appState.token,
    appState.refreshKey,
    page,
    title,
    genres,
    sort,
    pageSize,
  ]);

  function updateQuery(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (value === "" || value == null) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);
  }

  return (
    <main className="layout-stack">
      <section className="page-heading panel">
        <div>
          <p className="eyebrow">Protected catalog</p>
          <h1 className="page-title">The archive of moving records</h1>
        </div>
        <div className="heading-actions">
          <span className="header-badge">
            {getMetadataLabel(state.metadata)}
          </span>
          <Link to="/movies/new" className="button button-primary">
            Add movie
          </Link>
        </div>
      </section>

      <StatusMessages />

      <section className="panel filter-panel">
        <div className="filter-grid">
          <label>
            <span>Title search</span>
            <input
              type="text"
              value={title}
              onChange={(event) =>
                updateQuery({ title: event.target.value, page: 1 })
              }
              placeholder="Filter by title"
            />
          </label>
          <label>
            <span>Genres</span>
            <input
              type="text"
              value={genres}
              onChange={(event) =>
                updateQuery({ genres: event.target.value, page: 1 })
              }
              placeholder="fantasy, drama"
            />
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) =>
                updateQuery({ sort: event.target.value, page: 1 })
              }
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {state.error ? <p className="feedback error">{state.error}</p> : null}

      <section className="movie-grid">
        {state.loading ? (
          <article className="panel empty-panel">
            <p>Loading movies from the protected endpoint...</p>
          </article>
        ) : state.movies.length === 0 ? (
          <article className="panel empty-panel">
            <p>No movies matched the current filters.</p>
          </article>
        ) : (
          state.movies.map((movie) => (
            <article key={movie.id} className="panel movie-card">
              <p className="movie-eyebrow">Record #{movie.id}</p>
              <h2>{movie.title}</h2>
              <p className="movie-summary">
                {movie.year} • {formatRuntime(movie.runtime)}
              </p>
              <p className="movie-tags">{formatGenres(movie.genres)}</p>
              <div className="card-actions">
                <Link
                  to={`/movies/${movie.id}`}
                  className="button button-primary"
                >
                  View detail
                </Link>
                <Link
                  to={`/movies/${movie.id}/edit`}
                  className="button button-ghost"
                >
                  Edit
                </Link>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="pagination-row panel">
        <button
          className="button button-ghost"
          onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="body-copy">Current page: {page}</span>
        <button
          className="button button-ghost"
          onClick={() => updateQuery({ page: page + 1 })}
          disabled={Boolean(state.metadata && page >= state.metadata.last_page)}
        >
          Next
        </button>
      </section>
    </main>
  );
}

function MovieDetailPage() {
  const appState = useAppState();
  const navigate = useNavigate();
  const { movieId } = useParams();
  const [state, setState] = useState({
    loading: true,
    error: "",
    movie: null,
    busy: false,
  });

  useEffect(() => {
    let ignore = false;

    async function loadMovie() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const payload = await getMovie(appState.token, movieId);
        if (!ignore) {
          setState({
            loading: false,
            error: "",
            movie: payload.movie,
            busy: false,
          });
        }
      } catch (error) {
        if (!ignore) {
          setState({
            loading: false,
            error: formatApiError(error),
            movie: null,
            busy: false,
          });
        }
      }
    }

    loadMovie();
    return () => {
      ignore = true;
    };
  }, [appState.token, appState.refreshKey, movieId]);

  async function handleDelete() {
    if (!state.movie) return;

    const confirmed = window.confirm(`Delete "${state.movie.title}"?`);
    if (!confirmed) return;

    appState.clearMessages();
    setState((current) => ({ ...current, busy: true }));

    try {
      await deleteMovie(appState.token, state.movie.id);
      appState.setNotice(`Deleted "${state.movie.title}".`);
      appState.bumpRefreshKey();
      navigate("/movies");
    } catch (error) {
      appState.setErrorMessage(formatApiError(error));
      setState((current) => ({ ...current, busy: false }));
    }
  }

  return (
    <main className="layout-stack">
      <section className="page-heading panel">
        <div>
          <p className="eyebrow">Movie detail</p>
          <h1 className="page-title">
            {state.movie ? state.movie.title : "Selected record"}
          </h1>
        </div>
        <div className="heading-actions">
          <Link to="/movies" className="button button-ghost">
            Back to archive
          </Link>
          {state.movie ? (
            <Link
              to={`/movies/${state.movie.id}/edit`}
              className="button button-primary"
            >
              Edit movie
            </Link>
          ) : null}
        </div>
      </section>

      <StatusMessages />

      {state.error ? <p className="feedback error">{state.error}</p> : null}

      {state.loading ? (
        <section className="panel empty-panel">
          <p>Loading movie detail...</p>
        </section>
      ) : state.movie ? (
        <section className="detail-layout">
          <article className="panel detail-panel">
            <dl className="detail-grid">
              <div>
                <dt>Title</dt>
                <dd>{state.movie.title}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>{state.movie.year}</dd>
              </div>
              <div>
                <dt>Runtime</dt>
                <dd>{formatRuntime(state.movie.runtime)}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{state.movie.version}</dd>
              </div>
              <div>
                <dt>Genres</dt>
                <dd>{formatGenres(state.movie.genres)}</dd>
              </div>
              <div>
                <dt>Protection</dt>
                <dd>Bearer token and activated user permissions</dd>
              </div>
            </dl>
          </article>

          <article className="panel lore-panel">
            <p className="eyebrow">Control</p>
            <h2>Manage this archive entry</h2>
            <p className="body-copy">
              Inspect the full payload, move into the edit route, or remove the
              record entirely.
            </p>
            <div className="card-actions">
              <Link
                to={`/movies/${state.movie.id}/edit`}
                className="button button-primary"
              >
                Edit
              </Link>
              <button
                className="button button-ghost"
                onClick={handleDelete}
                disabled={state.busy}
              >
                {state.busy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}

function MovieFormPage({ mode }) {
  const appState = useAppState();
  const navigate = useNavigate();
  const { movieId } = useParams();
  const [form, setForm] = useState(initialMovieForm);
  const [movieVersion, setMovieVersion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (mode !== "edit" || !movieId) {
      setLoading(false);
      setLoadError("");
      return;
    }

    let ignore = false;

    async function loadMovie() {
      setLoading(true);
      setLoadError("");
      try {
        const payload = await getMovie(appState.token, movieId);
        if (!ignore) {
          setForm(movieToForm(payload.movie));
          setMovieVersion(payload.movie.version);
          setLoading(false);
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(formatApiError(error));
          setLoading(false);
        }
      }
    }

    loadMovie();
    return () => {
      ignore = true;
    };
  }, [mode, movieId, appState.token]);

  async function handleSubmit(event) {
    event.preventDefault();
    appState.clearMessages();
    setBusy(true);

    try {
      const payload = buildMoviePayload(form);

      if (mode === "create") {
        const response = await createMovie(appState.token, payload);
        appState.setNotice(`Created "${response.movie.title}".`);
        appState.bumpRefreshKey();
        navigate(`/movies/${response.movie.id}`);
      } else {
        const response = await updateMovie(
          appState.token,
          movieId,
          movieVersion,
          payload,
        );
        appState.setNotice(`Updated "${response.movie.title}".`);
        appState.bumpRefreshKey();
        navigate(`/movies/${response.movie.id}`);
      }
    } catch (error) {
      appState.setErrorMessage(formatApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="layout-stack">
      <section className="page-heading panel">
        <div>
          <p className="eyebrow">
            {mode === "create" ? "Create route" : "Edit route"}
          </p>
          <h1 className="page-title">
            {mode === "create"
              ? "Forge a new archive entry"
              : "Refine an existing record"}
          </h1>
        </div>
        <div className="heading-actions">
          <Link to="/movies" className="button button-ghost">
            Back to archive
          </Link>
        </div>
      </section>

      <StatusMessages />

      {loadError ? <p className="feedback error">{loadError}</p> : null}

      <section className="editor-layout">
        <article className="panel editor-panel">
          {loading ? (
            <p>Loading movie data...</p>
          ) : (
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>
                <span>Title</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Words of Radiance"
                  required
                />
              </label>
              <div className="split-fields">
                <label>
                  <span>Year</span>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        year: event.target.value,
                      }))
                    }
                    placeholder="2014"
                    required
                  />
                </label>
                <label>
                  <span>Runtime in minutes</span>
                  <input
                    type="number"
                    value={form.runtime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        runtime: event.target.value,
                      }))
                    }
                    placeholder="144"
                    required
                  />
                </label>
              </div>
              <label>
                <span>Genres</span>
                <input
                  type="text"
                  value={form.genres}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      genres: event.target.value,
                    }))
                  }
                  placeholder="fantasy, epic, drama"
                  required
                />
              </label>
              <button className="button button-primary" disabled={busy}>
                {busy
                  ? "Saving..."
                  : mode === "create"
                    ? "Create movie"
                    : "Save changes"}
              </button>
            </form>
          )}
        </article>

        <article className="panel lore-panel">
          <p className="eyebrow">Payload rules</p>
          <h2>Stay aligned with the Go validators.</h2>
          <ul className="plain-list">
            <li>Title is required and must be under 500 bytes.</li>
            <li>Year cannot be in the future.</li>
            <li>Runtime is sent as a string like `143 mins`.</li>
            <li>Genres are comma separated and should stay unique.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}

function StatusMessages() {
  const appState = useAppState();

  if (!appState.notice && !appState.errorMessage) {
    return null;
  }

  return (
    <section className="message-stack">
      {appState.notice ? (
        <p className="feedback success">{appState.notice}</p>
      ) : null}
      {appState.errorMessage ? (
        <p className="feedback error">{appState.errorMessage}</p>
      ) : null}
    </section>
  );
}
