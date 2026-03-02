// ==UserScript==
// @name            Goons Tracker - Local Times
// @author          Tosox
// @namespace       https://github.com/Tosox
// @homepage        https://github.com/Tosox/goons-tracker-local-times
// @supportURL      https://github.com/Tosox/goons-tracker-local-times/issues
// @updateURL       https://github.com/Tosox/goons-tracker-local-times/releases/latest/download/goons-tracker-local-times.user.js
// @downloadURL     https://github.com/Tosox/goons-tracker-local-times/releases/latest/download/goons-tracker-local-times.user.js
// @icon            https://github.com/Tosox/goons-tracker-local-times/blob/master/assets/icon.png?raw=true
// @description     Converts Goons tracker timestamps into your local time or relative elapsed time
// @version         1.1.0
// @license         MIT
// @copyright       Copyright (c) 2026 Tosox
// @match           https://www.goon-tracker.com/*
// @match           https://www.tarkov-goon-tracker.com/*
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_registerMenuCommand
// ==/UserScript==

(() => {
    "use strict";

    // -----------------------------
    // Settings
    // -----------------------------
    const SETTINGS_KEY = "gt_local_times_settings";
    const DEFAULT_PATTERN = "dd.MM.yyyy, HH:mm:ss";
    const DEFAULT_DISPLAY_MODE = "local";
    const PROCESSED_ATTR = "data-localized-time";
    const ORIGINAL_ATTR = "data-localized-time-original";
    const UTC_MS_ATTR = "data-localized-time-utc";
    const SHOW_SECONDS_ATTR = "data-localized-time-seconds";
    const RENDERED_ATTR = "data-localized-time-rendered";
    const RELATIVE_REFRESH_MS = 1000;
    const DISPLAY_MODES = {
        LOCAL: "local",
        RELATIVE: "relative",
    };

    const ALLOWED_TOKENS = new Set([
        "yyyy", "yy",
        "MM", "M",
        "dd", "d",
        "HH", "H",
        "hh", "h",
        "mm", "m",
        "ss", "s",
        "a"
    ]);

    function normalizeDisplayMode(value) {
        return value === DISPLAY_MODES.RELATIVE ? DISPLAY_MODES.RELATIVE : DISPLAY_MODES.LOCAL;
    }

    function readSettings() {
        const raw = GM_getValue(SETTINGS_KEY, null);
        if (!raw) {
            return {
                pattern: "",
                displayMode: DEFAULT_DISPLAY_MODE
            };
        }

        try {
            const obj = (typeof raw === "string" ? JSON.parse(raw) : raw);
            return {
                pattern: (obj?.pattern ?? ""),
                displayMode: normalizeDisplayMode(obj?.displayMode)
            };
        } catch {
            return {
                pattern: "",
                displayMode: DEFAULT_DISPLAY_MODE
            };
        }
    }

    function writeSettings(next) {
        const current = readSettings();
        const merged = {
            pattern: (next?.pattern ?? current.pattern ?? ""),
            displayMode: normalizeDisplayMode(next?.displayMode ?? current.displayMode)
        };
        GM_setValue(SETTINGS_KEY, JSON.stringify(merged));
        return merged;
    }

    function getDisplayMode() {
        return normalizeDisplayMode(readSettings().displayMode);
    }

    // -----------------------------
    // Default pattern
    // -----------------------------
    function guessLocalePrefersHour12() {
        try {
            return new Intl.DateTimeFormat(undefined, {
                hour: "numeric"
            }).resolvedOptions().hour12 === true;
        } catch {
            return false;
        }
    }

    function guessDefaultPattern() {
        const prefers12h = guessLocalePrefersHour12();
        const sample = new Date(2006, 0, 2, 15, 4, 5);
        const dtf = new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: prefers12h,
        });

        const parts = dtf.formatToParts(sample);

        const map = {
            year: "yyyy",
            month: "MM",
            day: "dd",
            hour: prefers12h ? "hh" : "HH",
            minute: "mm",
            second: "ss",
            dayPeriod: "a",
        };

        let pattern = "";
        for (const p of parts) {
            if (p.type in map) {
                pattern += map[p.type];
            } else {
                pattern += p.value;
            }
        }

        if (!pattern) {
            return DEFAULT_PATTERN;
        }

        return pattern.trim();
    }

    function getDefaultPattern() {
        const s = readSettings();
        if (s.pattern && s.pattern.trim()) {
            return s.pattern.trim();
        }

        const guessed = guessDefaultPattern();
        const fallback = guessed && guessed.length ? guessed : DEFAULT_PATTERN;
        writeSettings({
            pattern: fallback
        });
        return fallback;
    }

    // -----------------------------
    // Pattern validation
    // -----------------------------
    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function validatePattern(pattern) {
        if (!pattern) {
            return false;
        }

        const p = pattern.trim();
        if (!p) {
            return false;
        }

        const tokens = Array.from(ALLOWED_TOKENS).sort((a, b) => b.length - a.length);
        if (/[\r\n\t]/.test(p)) {
            return false;
        }

        let stripped = p;
        for (const t of tokens) {
            stripped = stripped.split(t).join("");
        }
        if (/[A-Za-z]/.test(stripped)) {
            return false;
        }

        return true;
    }

    function formatByPattern(date, pattern) {
        const hour24 = date.getHours();
        const hour12 = (hour24 % 12) || 12;
        const ampm = (hour24 < 12 ? "AM" : "PM");

        const map = {
            yyyy: String(date.getFullYear()),
            yy: String(date.getFullYear()).slice(-2),

            MM: pad2(date.getMonth() + 1),
            M: String(date.getMonth() + 1),

            dd: pad2(date.getDate()),
            d: String(date.getDate()),

            HH: pad2(hour24),
            H: String(hour24),

            hh: pad2(hour12),
            h: String(hour12),

            mm: pad2(date.getMinutes()),
            m: String(date.getMinutes()),

            ss: pad2(date.getSeconds()),
            s: String(date.getSeconds()),

            a: ampm,
        };

        const tokens = Object.keys(map).sort((a, b) => b.length - a.length);
        let out = pattern;
        for (const t of tokens) {
            out = out.replaceAll(t, map[t]);
        }

        return out;
    }

    // -----------------------------
    // Seconds-on-demand
    // -----------------------------
    function originalShowsSeconds(originalText) {
        return /(\d{1,2}:\d{2}:\d{2})/.test(originalText);
    }

    function patternHasSeconds(pattern) {
        return pattern.includes("ss") || pattern.includes("s");
    }

    function ensureSecondsInPattern(pattern) {
        if (patternHasSeconds(pattern)) return pattern;

        // Prefer inserting after minutes token
        if (pattern.includes("mm")) return pattern.replace("mm", "mm:ss");
        if (pattern.includes("m")) return pattern.replace("m", "m:s");

        // Fallback: append seconds
        return (pattern.trim().length ? (pattern.trim() + ":ss") : "HH:mm:ss");
    }

    function removeSecondsFromPattern(pattern) {
        if (!patternHasSeconds(pattern)) return pattern;

        // Remove seconds token plus a preceding ":" when present (e.g., "HH:mm:ss" -> "HH:mm")
        let p = pattern.replace(/(:)?(ss|s)\b/g, "");

        // Clean up any dangling separators/spaces created by removal
        p = p.replace(/\s{2,}/g, " ");
        p = p.replace(/,\s*,/g, ", ");
        p = p.replace(/:\s*(?=[,\s]|$)/g, ""); // remove trailing ":" if it ends up before comma/space/end
        return p.trim();
    }

    function formatLocal(date, { showSeconds } = {}) {
        const userPattern = (readSettings().pattern || "").trim();
        const defaultPattern = getDefaultPattern();
        let effective = validatePattern(userPattern) ? userPattern : defaultPattern;

        if (showSeconds) {
            effective = ensureSecondsInPattern(effective);
        } else { 
            effective = removeSecondsFromPattern(effective);
        }

        return formatByPattern(date, effective);
    }

    function formatRelative(utcMs) {
        const diffMs = Date.now() - utcMs;
        if (!Number.isFinite(diffMs)) {
            return "0s ago";
        }

        const isPast = diffMs >= 0;
        const totalSeconds = Math.max(0, Math.floor(Math.abs(diffMs) / 1000));

        let value = totalSeconds;
        let unit = "s";

        if (totalSeconds >= 86400) {
            value = Math.floor(totalSeconds / 86400);
            unit = "d";
        } else if (totalSeconds >= 3600) {
            value = Math.floor(totalSeconds / 3600);
            unit = "h";
        } else if (totalSeconds >= 60) {
            value = Math.floor(totalSeconds / 60);
            unit = "m";
        }

        return isPast ? `${value}${unit} ago` : `in ${value} ${unit}`;
    }

    // -----------------------------
    // Menu
    // -----------------------------
    function registerMenu() {
        GM_registerMenuCommand("Toggle display mode", () => {
            const nextDisplayMode = getDisplayMode() === DISPLAY_MODES.RELATIVE
                ? DISPLAY_MODES.LOCAL
                : DISPLAY_MODES.RELATIVE;

            writeSettings({
                displayMode: nextDisplayMode
            });
            syncRelativeRefresh();
            run();
        });

        GM_registerMenuCommand("Set date pattern", () => {
            const cur = (readSettings().pattern || "").trim();
            const def = getDefaultPattern();

            const input = prompt(
                [
                    "Enter a custom date/time pattern.",
                    "",
                    "Supported tokens:",
                    "  yyyy yy  MM M  dd d  HH H  hh h  mm m  ss s  a",
                    "",
                    "Examples:",
                    "  24h: dd.MM.yyyy, HH:mm:ss",
                    "  12h: dd.MM.yyyy, hh:mm:ss a",
                    "",
                    `Current: ${cur || "(not set)"}`,
                    `Default: ${def}`,
                    "",
                    "If your pattern is invalid, the script falls back to the default."
                ].join("\n"),
                cur || def
            );
            if (input === null) {
                return;
            }

            writeSettings({
                pattern: input.trim()
            });
            run();
        });
    }

    // -----------------------------
    // Parsers
    // -----------------------------
    const MONTHS = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
    };

    // "Jan 05, 2026 10:20 AM z."
    function parseTarkovGoon(text) {
        if (!text) {
            return null;
        }

        const s = text.trim().replace(/\s+/g, " ").replace(/\.$/, "");
        const m = s.match(/^([A-Za-z]{3})\s+(\d{2}),\s+(\d{4})\s+(\d{2}):(\d{2})\s+(AM|PM)\s+z$/i);
        if (!m) {
            return null;
        }

        const monStr = m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase();
        const month = MONTHS[monStr];
        if (month === undefined) {
            return null;
        }

        const day = Number(m[2]);
        const year = Number(m[3]);
        let hour = Number(m[4]);
        const minute = Number(m[5]);
        const ampm = m[6].toUpperCase();

        if (ampm === "AM") {
            if (hour === 12) {
                hour = 0;
            }
        } else {
            if (hour !== 12) {
                hour += 12;
            }
        }

        return {
            year,
            month,
            day,
            hour,
            minute,
            second: 0
        };
    }

    // "2026-01-22 10:30:01" or "2026-01-22 10:30:01 PST"
    function parseSqlDateTime(text) {
        if (!text) {
            return null;
        }

        const s = text.trim().replace(/\s+/g, " ");
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\s+([A-Za-z]{2,5}))?$/);
        if (!m) {
            return null;
        }

        return {
            year: Number(m[1]),
            month: Number(m[2]) - 1,
            day: Number(m[3]),
            hour: Number(m[4]),
            minute: Number(m[5]),
            second: Number(m[6]),
            tzAbbrev: m[7] ? m[7].toUpperCase() : null,
        };
    }

    // -----------------------------
    // Timezone conversion
    // -----------------------------
    function tzOffsetMs(instantMs, timeZone) {
        const dtf = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });

        const parts = dtf.formatToParts(new Date(instantMs));
        const get = (type) => parts.find((p) => p.type === type)?.value;

        const y = Number(get("year"));
        const mo = Number(get("month"));
        const d = Number(get("day"));
        const h = Number(get("hour"));
        const mi = Number(get("minute"));
        const s = Number(get("second"));

        const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
        return asUtc - instantMs;
    }

    function zonedTimeToUtcMs(wallClock, timeZone) {
        const {
            year,
            month,
            day,
            hour,
            minute,
            second = 0
        } = wallClock;

        let guess = Date.UTC(year, month, day, hour, minute, second);
        for (let i = 0; i < 2; i++) {
            const offset = tzOffsetMs(guess, timeZone);
            guess = Date.UTC(year, month, day, hour, minute, second) - offset;
        }

        return guess;
    }

    // -----------------------------
    // DOM helpers
    // -----------------------------
    const q = (sel, root = document) => root.querySelector(sel);
    const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    let relativeRefreshId = null;

    function syncRelativeRefresh() {
        if (getDisplayMode() === DISPLAY_MODES.RELATIVE) {
            if (relativeRefreshId === null) {
                relativeRefreshId = setInterval(run, RELATIVE_REFRESH_MS);
            }
            return;
        }

        if (relativeRefreshId !== null) {
            clearInterval(relativeRefreshId);
            relativeRefreshId = null;
        }
    }

    function clearStoredState(el) {
        el.removeAttribute(PROCESSED_ATTR);
        el.removeAttribute(ORIGINAL_ATTR);
        el.removeAttribute(UTC_MS_ATTR);
        el.removeAttribute(SHOW_SECONDS_ATTR);
        el.removeAttribute(RENDERED_ATTR);
    }

    // -----------------------------
    // Conversion pipeline
    // -----------------------------
    function convertElement(el, {
        parse,
        sourceTz,
        title
    }) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        const currentText = (el.textContent || "").trim();
        const storedOriginal = el.getAttribute(ORIGINAL_ATTR);
        const storedUtcMs = el.getAttribute(UTC_MS_ATTR);
        const storedRendered = el.getAttribute(RENDERED_ATTR);

        let original = currentText;
        let utcMs = Number(storedUtcMs);
        let showSeconds = el.getAttribute(SHOW_SECONDS_ATTR) === "1";

        const canReuseStored = storedOriginal !== null
            && storedUtcMs !== null
            && storedRendered !== null
            && currentText === storedRendered;

        if (canReuseStored) {
            original = storedOriginal;
            if (!Number.isFinite(utcMs)) {
                clearStoredState(el);
                return false;
            }
        } else {
            const parsed = parse(currentText);
            if (!parsed) {
                if (storedRendered !== null && currentText !== storedRendered) {
                    clearStoredState(el);
                }
                return false;
            }

            showSeconds = originalShowsSeconds(currentText);
            utcMs = zonedTimeToUtcMs(parsed, sourceTz);
            if (!Number.isFinite(utcMs)) {
                clearStoredState(el);
                return false;
            }

            el.setAttribute(PROCESSED_ATTR, "1");
            el.setAttribute(ORIGINAL_ATTR, currentText);
            el.setAttribute(UTC_MS_ATTR, String(utcMs));
            el.setAttribute(SHOW_SECONDS_ATTR, showSeconds ? "1" : "0");
        }

        const localStr = formatLocal(new Date(utcMs), { showSeconds });
        const displayText = getDisplayMode() === DISPLAY_MODES.RELATIVE
            ? formatRelative(utcMs)
            : localStr;

        if (currentText !== displayText) {
            el.textContent = displayText;
        }

        el.setAttribute(RENDERED_ATTR, displayText);
        if (title) {
            el.title = title(original, sourceTz, localStr);
        }

        return true;
    }

    function convertElements(elements, opts) {
        for (const el of elements) {
            convertElement(el, opts);
        }
    }

    function elementsFrom(selector, mapFn = (el) => el, root = document) {
        return qa(selector, root).map(mapFn).filter(Boolean);
    }

    // -----------------------------
    // Sites
    // -----------------------------
    const SITES = [
        {
            match: (host) => host.includes("tarkov-goon-tracker.com"),
            run: () => {
                const section = q("#trackings");
                if (!section) {
                    return;
                }

                const divs = qa(":scope > div", section);
                if (divs.length < 2) {
                    return;
                }

                const tbody = q("tbody", divs[1]);
                if (!tbody) {
                    return;
                }

                const tds = elementsFrom(":scope > tr", (tr) => qa(":scope > td", tr)[1], tbody);
                convertElements(tds, {
                    parse: parseTarkovGoon,
                    sourceTz: "America/New_York",
                    title: (orig, tz, local) => `Original: ${orig} (interpreted as ${tz})\nLocal: ${local}`
                });
            },
        },
        {
            match: (host) => host.includes("goon-tracker.com"),
            run: () => {
                const tbody = q(".table-container table tbody");
                if (tbody) {
                    const tds = elementsFrom("tr", (tr) => qa("td", tr)[1], tbody);

                    convertElements(tds, {
                        parse: parseSqlDateTime,
                        sourceTz: "America/Los_Angeles",
                        title: (orig, tz, local) => `Original: ${orig} (interpreted as ${tz})\nLocal: ${local}`
                    });
                }

                const lastSeenSpan = q(".last-seen p:nth-of-type(2) span");
                if (lastSeenSpan) {
                    convertElement(lastSeenSpan, {
                        parse: parseSqlDateTime,
                        sourceTz: "America/Los_Angeles",
                        title: (orig, tz, local) => `Original: ${orig} (interpreted as ${tz})\nLocal: ${local}`
                    });
                }
            },
        },
    ];

    function run() {
        try {
            const host = location.hostname;
            for (const site of SITES) {
                if (site.match(host)) {
                    site.run();
                    break;
                }
            }
        } catch(e) {
            console.debug("[Goons Tracker - Local Times] Error:", e);
        }
    }

    registerMenu();
    getDefaultPattern();
    syncRelativeRefresh();
    run();

    new MutationObserver(run).observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();
