import config from "../../../config/config.js";
import { HttpError } from "../../lib/http-error.js";

// Availability is checked on every CMS menu load, so the probe is short and its
// result is reused. A service that dies is noticed within half a minute.
const PROBE_TIMEOUT_MS = 1500;
const PROBE_CACHE_MS = 30_000;
const READ_TIMEOUT_MS = 3000;

let probeCache = null;

const baseUrl = () => String(config.faceServiceUrl || "").replace(/\/+$/, "");

const unavailable = () => ({ available: false });

export const clearFaceProbeCache = () => {
  probeCache = null;
};

// Never throws: the CMS asks this to decide whether the Face menu exists, and a
// dead service must look like a missing feature, not like an error page.
export const probeFaceService = async () => {
  if (probeCache && probeCache.expiresAt > Date.now()) return probeCache.value;

  const url = baseUrl();
  if (!url) return unavailable();

  let value;
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!response.ok) {
      value = unavailable();
    } else {
      const health = await response.json();
      value = {
        available: true,
        model_version: health.model_version ?? null,
        templates: Number(health.templates || 0),
        threshold: health.threshold ?? null,
        margin: health.margin ?? null,
      };
    }
  } catch {
    value = unavailable();
  }

  probeCache = { value, expiresAt: Date.now() + PROBE_CACHE_MS };
  return value;
};

const requestFaceService = async (path, params) => {
  const url = baseUrl();
  if (!url) {
    throw new HttpError(503, "FACE_UNAVAILABLE", "Face service is not configured");
  }

  const target = new URL(`${url}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      target.searchParams.set(key, String(value));
    }
  }

  let response;
  try {
    response = await fetch(target, {
      headers: config.faceInternalToken ? { "X-Face-Token": config.faceInternalToken } : {},
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(503, "FACE_UNAVAILABLE", "Face service is not reachable");
  }

  if (!response.ok) {
    throw new HttpError(502, "FACE_SERVICE_ERROR", "Face service did not answer the request");
  }
  return response.json();
};

export const fetchFaceTemplates = async ({ limit, offset }) => requestFaceService("/templates", { limit, offset });

export const fetchFaceVerifyLog = async ({ result, limit, offset }) =>
  requestFaceService("/verify-log", { result, limit, offset });
