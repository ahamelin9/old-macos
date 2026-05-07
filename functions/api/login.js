// functions/api/login.js
export async function onRequest(context) {
  const { env } = context;
  const client_id = env.SPOTIFY_CLIENT_ID;
  const redirect_uri = `${new URL(context.request.url).origin}/api/callback`;
  
  const scope = "user-read-private user-read-email user-modify-playback-state user-read-playback-state streaming";
  
  const spotifyUrl = new URL("https://accounts.spotify.com/authorize");
  spotifyUrl.searchParams.append("response_type", "code");
  spotifyUrl.searchParams.append("client_id", client_id);
  spotifyUrl.searchParams.append("scope", scope);
  spotifyUrl.searchParams.append("redirect_uri", redirect_uri);
  spotifyUrl.searchParams.append("show_dialog", "true");

  return Response.redirect(spotifyUrl.toString(), 307);
}
