import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ProfilePage } from "./pages/ProfilePage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { StudyPlannerPage } from "./pages/StudyPlannerPage";
import { SettingsPage } from "./pages/SettingsPage";

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/study-planner" element={<StudyPlannerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
