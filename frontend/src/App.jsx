// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import Sidebar from './components/Sidebar';
// import Dashboard from './pages/Dashboard';
// import Customers from './pages/Customers';
// import NewCampaign from './pages/NewCampaign';
// import Campaigns from './pages/Campaigns';
// import CampaignDetail from './pages/CampaignDetail';

// function App() {
//   return (
//     <BrowserRouter>
//       <div className="flex h-screen bg-background overflow-hidden">
//         <Sidebar />
//         <div className="flex-1 flex flex-col overflow-hidden bg-background">
//           <main className="flex-1 overflow-x-hidden overflow-y-auto p-8">
//             <Routes>
//               <Route path="/" element={<Navigate to="/dashboard" replace />} />
//               <Route path="/dashboard" element={<Dashboard />} />
//               <Route path="/customers" element={<Customers />} />
//               <Route path="/campaigns/new" element={<NewCampaign />} />
//               <Route path="/campaigns" element={<Campaigns />} />
//               <Route path="/campaigns/:id" element={<CampaignDetail />} />
//             </Routes>
//           </main>
//         </div>
//       </div>
//     </BrowserRouter>
//   );
// }

// export default App;

import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import NewCampaign from "./pages/NewCampaign";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Simulated Multi-User Accounts for the Hackathon Judges
  const validUsers = {
    admin: "admin123",
    judge_team: "hackathon2026",
    sujith: "pawlife2026",
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (validUsers[username] && validUsers[username] === password) {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Invalid username or password! Try admin / admin123");
    }
  };

  // 1. Gatekeeper View: If not authenticated, show the login screen
  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#0f172a",
          fontFamily: "sans-serif",
          color: "#fff",
        }}
      >
        <form
          onSubmit={handleLogin}
          style={{
            background: "#1e293b",
            padding: "40px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
            width: "340px",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "8px",
              color: "#38bdf8",
            }}
          >
            PawLife AI CRM
          </h2>
          <p
            style={{
              textAlign: "center",
              fontSize: "14px",
              color: "#94a3b8",
              marginBottom: "24px",
            }}
          >
            Hackathon Portal Login
          </p>

          {error && (
            <p
              style={{
                color: "#ef4444",
                fontSize: "13px",
                textAlign: "center",
                background: "#451a1a",
                padding: "8px",
                borderRadius: "6px",
              }}
            >
              {error}
            </p>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#cbd5e1",
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #475569",
                background: "#334155",
                color: "#fff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                color: "#cbd5e1",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #475569",
                background: "#334155",
                color: "#fff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#0284c7",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Sign In
          </button>

          <div
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              marginTop: "20px",
              backgroundColor: "#0f172a",
              padding: "10px",
              borderRadius: "6px",
              border: "1px dashed #334155",
            }}
          >
            <strong>Demo judge credentials:</strong>
            <br />
            User: <code style={{ color: "#f43f5e" }}>admin</code> | Pass:{" "}
            <code style={{ color: "#f43f5e" }}>admin123</code>
          </div>
        </form>
      </div>
    );
  }

  // 2. Main Application View: Original structure from image_525491.jpg completely intact!
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-8">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/campaigns/new" element={<NewCampaign />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
