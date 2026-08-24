import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/locales";

export default createMiddleware({
  locales: [...locales],
  defaultLocale
});

export const config = {
  matcher: ["/((?!_next|favicon\\.ico|.*\\..*).*)"]
};
