import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public pages — do NOT require login
const isPublicRoute = createRouteMatcher([
  "/",                 // mood page
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/chat",         // guest users allowed
  "/api/history",
  "/api/load-chat",
  "/api/delete-chat",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth(); // Clerk v5 async auth
  const url = req.nextUrl;

  // PUBLIC route → allow without login
  if (isPublicRoute(req)) return NextResponse.next();

  // PRIVATE route → require login
  if (!userId) {
    const signInUrl = new URL("/sign-in", url.origin);
    signInUrl.searchParams.set("redirect_url", url.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Authenticated → continue
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", 
    "/(api|trpc)(.*)"
  ],
};
