import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/locales";

export default createMiddleware({
  locales: [...locales],
  defaultLocale
});

export const config = {
  // `/api/*` is the public spin endpoint and must not be re-written by the
  // locale middleware (it has no locale segment and would 404 after a
  // redirect if matched).
  matcher: ["/((?!api/|_next|favicon\\.ico|.*\\..*).*)"]
};
