/**
 * Redirects to a path on this site.
 *
 * `NextResponse.redirect(new URL(path, request.url))` reads correctly and is
 * wrong behind a proxy: on Railway `request.url` carries the internal origin,
 * so a streamer who finished Twitch sign-in was sent to
 * `https://localhost:3000/dashboard`. It did not show up locally, because
 * locally that origin happens to be the right one — it showed up on the first
 * request to the deployed service.
 *
 * The Location header here is relative, which RFC 7231 §7.1.2 allows and which
 * browsers resolve against the address they actually asked for. The other
 * repair — rebuilding the origin from `x-forwarded-host` — would mean letting a
 * client-supplied header decide where we send people, which is an open redirect
 * with extra steps.
 */
import { NextResponse } from 'next/server';

export function redirectTo(path: string, status: 303 | 307 = 307): NextResponse {
  return new NextResponse(null, { status, headers: { location: path } });
}
