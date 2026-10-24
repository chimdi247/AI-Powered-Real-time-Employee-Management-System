import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // Quietly intercept Chrome DevTools or other well-known requests
  return new Response(null, {
    status: 404,
    statusText: "Not Found",
  });
}

export default function WellKnownCatchAll() {
  return null;
}
