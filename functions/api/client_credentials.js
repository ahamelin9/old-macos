// functions/api/client_credentials.js
export async function onRequest(context) {
  const { env } = context;
  const client_id = env.SPOTIFY_CLIENT_ID || env.VITE_SPOTIFY_CLIENT_ID;
  const client_secret = env.SPOTIFY_CLIENT_SECRET || env.VITE_SPOTIFY_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return new Response(JSON.stringify({ error: "Missing credentials" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const authHeader = btoa(`${client_id}:${client_secret}`);

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
