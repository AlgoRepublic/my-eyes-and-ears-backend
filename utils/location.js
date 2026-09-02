const { CustomError } = require("./error");

const LOCATION_FIELDS = [
  "latitude",
  "longitude",
  "accuracy",
  "address",
  "city",
  "state",
  "country",
  "postalCode",
  "updatedAt",
];

const FIELD_ALIASES = {
  lat: "latitude",
  lng: "longitude",
  locality: "city",
  administrativeArea: "state",
  zipCode: "postalCode",
};

const normalizeOptionalString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const parseOptionalNumber = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new CustomError(`${fieldName} is required`, [], 400);
    }
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new CustomError(`${fieldName} must be a valid number`, [], 400);
  }

  return parsed;
};

const canonicalizeLocationSource = (source = {}) => {
  const normalized = { ...source };

  for (const [alias, canonical] of Object.entries(FIELD_ALIASES)) {
    if (normalized[canonical] === undefined && normalized[alias] !== undefined) {
      normalized[canonical] = normalized[alias];
    }
  }

  return normalized;
};

/**
 * Pull location from nested objects, JSON strings, or flat multipart keys
 * like `location[latitude]`.
 */
const extractLocationPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "location")) {
    const value = payload.location;

    if (value === null) {
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return canonicalizeLocationSource(parsed);
        }
      } catch (_error) {
        // Treat plain strings as legacy address-only values.
      }

      return { address: trimmed };
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return canonicalizeLocationSource(value);
    }

    return undefined;
  }

  const nested = {};
  let found = false;

  for (const [key, value] of Object.entries(payload)) {
    const match = /^location\[([^\]]+)\]$/.exec(key);
    if (!match) continue;
    nested[match[1]] = value;
    found = true;
  }

  if (!found) {
    return undefined;
  }

  return canonicalizeLocationSource(nested);
};

const normalizeLocationInput = (rawLocation, { requireCoordinates = true } = {}) => {
  if (rawLocation === undefined) {
    return undefined;
  }

  if (rawLocation === null) {
    return null;
  }

  const source = canonicalizeLocationSource(rawLocation);
  const latitude = parseOptionalNumber(source.latitude, "location.latitude", {
    required: requireCoordinates,
  });
  const longitude = parseOptionalNumber(source.longitude, "location.longitude", {
    required: requireCoordinates,
  });

  if (requireCoordinates) {
    if (latitude < -90 || latitude > 90) {
      throw new CustomError("location.latitude must be between -90 and 90", [], 400);
    }
    if (longitude < -180 || longitude > 180) {
      throw new CustomError(
        "location.longitude must be between -180 and 180",
        [],
        400,
      );
    }
  } else if (
    (latitude === undefined) !== (longitude === undefined) ||
    (latitude !== undefined && (latitude < -90 || latitude > 90)) ||
    (longitude !== undefined && (longitude < -180 || longitude > 180))
  ) {
    throw new CustomError(
      "location.latitude and location.longitude must both be valid coordinates",
      [],
      400,
    );
  }

  const accuracy = parseOptionalNumber(source.accuracy, "location.accuracy");
  const address = normalizeOptionalString(source.address);
  const city = normalizeOptionalString(source.city);
  const state = normalizeOptionalString(source.state);
  const country = normalizeOptionalString(source.country);
  const postalCode = normalizeOptionalString(source.postalCode);

  let updatedAt;
  if (source.updatedAt !== undefined && source.updatedAt !== null && source.updatedAt !== "") {
    const parsedUpdatedAt = new Date(source.updatedAt);
    if (Number.isNaN(parsedUpdatedAt.getTime())) {
      throw new CustomError("location.updatedAt must be a valid date", [], 400);
    }
    updatedAt = parsedUpdatedAt;
  } else {
    updatedAt = new Date();
  }

  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);
  const hasAddressFields = [address, city, state, country, postalCode].some(
    (value) => value !== undefined && value !== null,
  );

  if (!hasCoordinates && !hasAddressFields && accuracy === undefined) {
    return null;
  }

  return {
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    accuracy: accuracy ?? null,
    address: address ?? null,
    city: city ?? null,
    state: state ?? null,
    country: country ?? null,
    postalCode: postalCode ?? null,
    updatedAt,
  };
};

const isFiniteCoordinate = (value) => {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  return Number.isFinite(Number(value));
};

const hasValidCoordinates = (location) => {
  if (!location || typeof location !== "object") {
    return false;
  }

  return (
    isFiniteCoordinate(location.latitude) &&
    isFiniteCoordinate(location.longitude)
  );
};

const formatLocationResponse = (location) => {
  if (!hasValidCoordinates(location)) {
    return null;
  }

  return {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    accuracy:
      location.accuracy === undefined || location.accuracy === null
        ? null
        : Number(location.accuracy),
    address: location.address ?? null,
    city: location.city ?? null,
    state: location.state ?? null,
    country: location.country ?? null,
    postalCode: location.postalCode ?? null,
    updatedAt: location.updatedAt
      ? new Date(location.updatedAt).toISOString()
      : null,
  };
};

/**
 * Member APIs historically returned a plain address string. Prefer a formatted
 * GPS object when coordinates exist; otherwise fall back to address text.
 */
const formatMemberLocationResponse = (location) => {
  const formatted = formatLocationResponse(location);
  if (formatted) {
    return formatted;
  }

  if (!location || typeof location !== "object") {
    if (typeof location === "string" && location.trim()) {
      return location.trim();
    }
    return null;
  }

  return location.address ?? null;
};

module.exports = {
  LOCATION_FIELDS,
  extractLocationPayload,
  normalizeLocationInput,
  hasValidCoordinates,
  formatLocationResponse,
  formatMemberLocationResponse,
};
