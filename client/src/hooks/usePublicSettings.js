import { useEffect, useState } from "react";
import { settingsApi } from "../api/settingsApi.js";

// Business name, contact details, policies and advance % set by the Owner in
// System Settings. Fetched once per page load and shared by every caller;
// falls back to defaults if the request fails.
const DEFAULTS = {
  businessName: "BookMyHall",
  tagline: "Hall & event booking for this restaurant.",
  contactEmail: "",
  contactPhone: "",
  address: "",
  policyNotes: "",
  advancePaymentPercentage: 50,
};

let cache = null;
let request = null;

export const refreshPublicSettings = () => {
  request = settingsApi
    .getPublic()
    .then((res) => {
      cache = { ...DEFAULTS, ...res.data.data };
      return cache;
    })
    .catch(() => cache || DEFAULTS);
  return request;
};

export const usePublicSettings = () => {
  const [settings, setSettings] = useState(cache || DEFAULTS);

  useEffect(() => {
    let active = true;
    (request || refreshPublicSettings()).then((s) => active && setSettings(s));
    return () => {
      active = false;
    };
  }, []);

  return settings;
};
