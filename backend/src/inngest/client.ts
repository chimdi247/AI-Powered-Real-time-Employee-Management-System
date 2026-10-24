import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "ems-app",  isDev: process.env.NODE_ENV !== "production", });

// production (cloud)
//export const inngest = new Inngest({ id: "ems-app" });
