import { ensureProcessTimezone } from "@shared/timezone";

/** Side-effect import: align process TZ with business default before other modules run. */
ensureProcessTimezone();
