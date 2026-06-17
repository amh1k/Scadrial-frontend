const DEFAULT_API_BASE_URL = "http://localhost:4000";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = new Error("Request failed");
    error.status = response.status;
    error.payload = payload;
    error.message = extractErrorMessage(payload) || `Request failed with status ${response.status}`;
    throw error;
  }

  return payload;
}

export function extractErrorMessage(payload) {
  if (!payload || payload.error == null) {
    return "";
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload.error === "object") {
    return Object.entries(payload.error)
      .map(([field, message]) => `${field}: ${message}`)
      .join(" | ");
  }

  return "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
}

export function getHealthcheck() {
  return request("/v1/healthcheck", { method: "GET" });
}

export function registerUser(payload) {
  return request("/v1/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function activateUser(token) {
  return request("/v1/users/activated", {
    method: "PUT",
    body: JSON.stringify({ token }),
  });
}

export function createAuthenticationToken(payload) {
  return request("/v1/tokens/authentication", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function authorizedHeaders(token, extras = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extras,
  };
}

export function listMovies({ token, title, genres, sort, page, pageSize }) {
  const query = new URLSearchParams();

  if (title) {
    query.set("title", title);
  }
  if (genres) {
    query.set("genres", genres);
  }
  if (sort) {
    query.set("sort", sort);
  }
  query.set("page", String(page));
  query.set("page_size", String(pageSize));

  return request(`/v1/movies?${query.toString()}`, {
    method: "GET",
    headers: authorizedHeaders(token),
  });
}

export function getMovie(token, id) {
  return request(`/v1/movies/${id}`, {
    method: "GET",
    headers: authorizedHeaders(token),
  });
}

export function createMovie(token, payload) {
  return request("/v1/movies", {
    method: "POST",
    headers: authorizedHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function updateMovie(token, id, version, payload) {
  return request(`/v1/movies/${id}`, {
    method: "PATCH",
    headers: authorizedHeaders(token, {
      "X-Expected-Version": String(version),
    }),
    body: JSON.stringify(payload),
  });
}

export function deleteMovie(token, id) {
  return request(`/v1/movies/${id}`, {
    method: "DELETE",
    headers: authorizedHeaders(token),
  });
}
