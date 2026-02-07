import { createApp } from "./app";

const { server } = createApp();

console.log(`Server running on http://localhost:${server.port}`);
