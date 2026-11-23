type ClerkMeMiddlewareContext = {
  request: Request;
  next: () => Promise<Response>;
};

/**
 * Use the apex domain as ClerkMe's canonical host.
 * This keeps host-only __Host- session cookies consistent when visitors use www.
 */
export const onRequest = async ({ request, next }: ClerkMeMiddlewareContext): Promise<Response> => {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  if (hostname === "clerkmd.pages.dev" || hostname === "www.clerkme.com.ng") {
    url.hostname = "clerkme.com.ng";
    return Response.redirect(url.toString(), 308);
  }
  try {
    return await next();
  } catch (error) {
    if (url.pathname.startsWith("/api/")) {
      console.error("[clerkme-api] Unhandled API request error.", {
        path: url.pathname,
        message: error instanceof Error ? error.message : "Unknown server error"
      });
      return new Response(JSON.stringify({
        error: "ClerkMe could not complete this request because a server-side operation failed. Please try again.",
        code: "API_INTERNAL_ERROR"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }
    throw error;
  }
};
