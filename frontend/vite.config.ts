import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // Intercepts Chrome DevTools requests before they hit React Router
    {
      name: "silence-well-known",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/.well-known/")) {
            res.statusCode = 404;
            res.end();
            return;
          }
          next();
        });
      },
    },
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
