// functions/api/refresh.js
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const refresh_token = url.searchParams.get("refresh_token");

  if (!refresh_token) {
    return new Response("Missing refresh token", { status: 400 });
  }

  const client_id = env.SPOTIFY_CLIENT_ID || env.VITE_SPOTIFY_CLIENT_ID;
  const client_secret = env.SPOTIFY_CLIENT_SECRET || env.VITE_SPOTIFY_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return new Response("Missing credentials", { status: 500 });
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
      refresh_token: refresh_token,
    }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
