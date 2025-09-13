//apps/web/src/pages/NotFound.tsx

// src/pages/NotFound.tsx
import { Link } from "react-router-dom";

const NotFound = () => (
  <main className="flex flex-col items-center justify-center h-screen text-center space-y-4">
    <h1 className="text-4xl font-bold">404</h1>
    <p className="text-gray-600">Page not found</p>
    <Link to="/" className="text-blue-600 hover:underline">Go Home</Link>
  </main>
);

export default NotFound;
