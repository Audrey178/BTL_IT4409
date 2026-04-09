import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:5001/api/v1"
      : "/api",
  withCredentials: true,
});

export default api;
