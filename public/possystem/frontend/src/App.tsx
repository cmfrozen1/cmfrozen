import React from "react";
import SidebarLayout from "./components/Layout/SidebarLayout";
import Dashboard from "./pages/Dashboard";
import "./index.css";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarLayout>
        <Dashboard />
      </SidebarLayout>
    </div>
  );
}

export default App;