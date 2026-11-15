// functions/api/refresh.js
// POST { refresh_token } -> Spotify's token response. POST only, so the
// refresh token never sits in a URL (browser history, server logs).
export async function onRequestPost(context) {
  const { env, request } = context;

  let refresh_token;
  try {
    ({ refresh_token } = await request.json());
  } catch {
    // fall through to the missing-token answer
  }
  if (!refresh_token) {
    return Response.json({ error: "Missing refresh_token" }, { status: 400 });
  }

  const client_id = env.SPOTIFY_CLIENT_ID || env.VITE_SPOTIFY_CLIENT_ID;
  const client_secret = env.SPOTIFY_CLIENT_SECRET || env.VITE_SPOTIFY_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return Response.json({ error: "Missing credentials" }, { status: 500 });
  }

  const authHeader = btoa(`${client_id}:${client_secret}`);

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  const data = await response.json();
  return Response.json(data, { status: response.status });
}
