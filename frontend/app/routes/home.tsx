import type { Route } from "./+types/home";
import { LoginPage } from "../components/auth/login-page";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign in | Employee Management System" },
    {
      name: "description",
      content: "Sign in to the Employee Management System.",
    },
  ];
}

export default function Home() {
  return <LoginPage />;
}
