// functions/api/callback.js
export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const client_id = env.SPOTIFY_CLIENT_ID;
  const client_secret = env.SPOTIFY_CLIENT_SECRET;
  const redirect_uri = `${url.origin}/api/callback`;

  if (error) {
    return Response.redirect(`${url.origin}/?error=${error}`, 307);
  }

  if (!code) {
    return Response.redirect(url.origin, 307);
  }

  const authHeader = btoa(`${client_id}:${client_secret}`);
  
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirect_uri,
    }),
  });

  if (!response.ok) {
    return new Response("Failed to exchange token", { status: 500 });
  }

  const tokens = await response.json();
  const finalUrl = `${url.origin}/?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`;
  
  return Response.redirect(finalUrl, 307);
}
