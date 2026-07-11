import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/u/:handle",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const handle = url.pathname.split("/u/")[1];
    if (!handle) {
      return new Response("Not found", { status: 404 });
    }
    const profile = await ctx.runQuery(api.users.getByHandle, { handle });
    if (!profile) {
      return new Response("User not found", { status: 404 });
    }
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profile.handle} on s.chat</title>
  <meta property="og:title" content="${profile.handle} on s.chat" />
  <meta property="og:description" content="${profile.about ?? `Chat with @${profile.handle} on s.chat`}" />
  <meta property="og:type" content="profile" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${profile.handle} on s.chat" />
  <meta name="twitter:description" content="${profile.about ?? `Chat with @${profile.handle} on s.chat`}" />
  <script>
    window.location.href = "/?handle=${profile.handle}";
  </script>
</head>
<body>
  <p>Redirecting to <a href="/?handle=${profile.handle}">s.chat/@${profile.handle}</a>…</p>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }),
});

http.route({
  path: "/invite",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response("Invalid invite link", { status: 400 });
    }
    const invite = await ctx.runQuery(api.invitations.getByCode, { code });
    const inviterName = invite?.inviterHandle ? `@${invite.inviterHandle}` : invite?.inviterName ?? "Someone";
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join s.chat - ${inviterName} invited you</title>
  <meta property="og:title" content="${inviterName} invited you to s.chat" />
  <meta property="og:description" content="End-to-end encrypted messaging. Join ${inviterName} on s.chat." />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${inviterName} invited you to s.chat" />
  <meta name="twitter:description" content="End-to-end encrypted messaging." />
  <script>
    window.location.href = "/?invite=${code}";
  </script>
</head>
<body>
  <p>Redirecting to <a href="/?code=${code}">s.chat invite</a>…</p>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }),
});

export default http;
