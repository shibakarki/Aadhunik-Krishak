import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { FarmProvider } from "./context/FarmContext";
import { Assistant } from "./pages/Assistant";
import { Calendar } from "./pages/Calendar";
import { Crops } from "./pages/Crops";
import { Dashboard } from "./pages/Dashboard";
import { FarmSelector } from "./pages/FarmSelector";
import { Feedback } from "./pages/Feedback";
import { LandIntelligence } from "./pages/LandIntelligence";
import { Login } from "./pages/Login";
import { PlantDoctor } from "./pages/PlantDoctor";
import { Register } from "./pages/Register";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FarmProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/farms/new" element={<FarmSelector />} />
              <Route path="/land-intelligence" element={<LandIntelligence />} />
              <Route path="/crops" element={<Crops />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/plant-doctor" element={<PlantDoctor />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/feedback" element={<Feedback />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FarmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;