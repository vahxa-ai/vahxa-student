import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { ProfilePage } from "./pages/ProfilePage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { StudyPlannerPage } from "./pages/StudyPlannerPage";
import { SubjectPage } from "./pages/SubjectPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ConsentPage } from "./pages/ConsentPage";
import { ParentPage } from "./pages/ParentPage";
import { AdminPage } from "./pages/AdminPage";

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      {/* Opened from the parent's email — works signed in or out, independent of the app shell */}
      <Route path="/consent/:token" element={<ConsentPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/study-planner" element={<StudyPlannerPage />} />
        <Route path="/study-planner/subjects/:subjectId" element={<SubjectPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/parent" element={<ParentPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
