import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export const Layout: React.FC = () => (
  <div className="flex min-h-screen">
    <Sidebar />
    <main className="flex-1 overflow-auto bg-gradient-to-br from-indigo-50 via-white to-violet-50/30 min-h-screen">
      <Outlet />
    </main>
  </div>
);
