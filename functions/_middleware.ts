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
  return next();
};
