import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { FamilyPage } from "./pages/FamilyPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { StudyPlannerPage } from "./pages/StudyPlannerPage";
import { MealPlannerPage } from "./pages/MealPlannerPage";
import { ShoppingListPage } from "./pages/ShoppingListPage";
import { CalendarPage } from "./pages/CalendarPage";
import { SettingsPage } from "./pages/SettingsPage";

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/study-planner" element={<StudyPlannerPage />} />
        <Route path="/meal-planner" element={<MealPlannerPage />} />
        <Route path="/shopping" element={<ShoppingListPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;
