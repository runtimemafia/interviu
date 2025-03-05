import axios from "axios";

const videoServerHealthCheck = (): Promise<boolean> => {
  return axios.get(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/healthcheck`);
};

export { videoServerHealthCheck };
