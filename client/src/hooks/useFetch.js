import { useCallback, useEffect, useState } from "react";
import { apiError } from "../utils/format.js";

export const useFetch = (fetchFn) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchFn()
      .then((res) => setData(res.data.data))
      // Friendly message for network/server failures (raw error goes to the console).
      .catch((err) => setError(apiError(err, "Failed to load")))
      .finally(() => setLoading(false));
    // fetchFn identity is expected to change when its inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFn]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
};
