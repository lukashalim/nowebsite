/** Side-effect import: pipeline env aligned with CRM cohort (25–199 reviews, 4+ rating). */
import "./env-nowebsite-queue.mjs";

process.env.ENABLE_CATEGORY_VALIDATION = "0";
process.env.ENABLE_WEAKNESS_SUMMARY = "0";
process.env.SWEET_SPOT_MIN_REVIEWS = "25";
process.env.SWEET_SPOT_MAX_REVIEWS = "199";
process.env.SWEET_SPOT_MIN_RATING = "4";
