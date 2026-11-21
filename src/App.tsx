import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import { Dashboard } from './pages/Dashboard';
import { FarmSelector } from './pages/FarmSelector';
import { Login } from './pages/Login';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { Register } from './pages/Register';

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
              <Route
                path="/land-intelligence"
                element={
                  <PlaceholderPage
                    title="Land Intelligence"
                    description="Soil pH, organic carbon, texture analysis, and agro-zone insights are coming soon."
                    owner="Priya"
                  />
                }
              />
              <Route
                path="/crops"
                element={
                  <PlaceholderPage
                    title="Crop Recommendations & Registration"
                    description="Smart Nepal crop matching and crop registration will appear here."
                    owner="Priya"
                  />
                }
              />
              <Route
                path="/calendar"
                element={
                  <PlaceholderPage
                    title="Farming Calendar & Smart Irrigation"
                    description="Stage-by-stage farming tasks and weather-aware irrigation advice will appear here."
                    owner="Priya"
                  />
                }
              />
              <Route
                path="/plant-doctor"
                element={
                  <PlaceholderPage
                    title="AI Plant Doctor"
                    description="Upload leaf photos for Gemini Vision disease diagnosis and treatment."
                    owner="Alisha"
                  />
                }
              />
              <Route
                path="/assistant"
                element={
                  <PlaceholderPage
                    title="AI Farming Assistant"
                    description="Context-aware agricultural chat tailored to your active farm."
                    owner="Alisha"
                  />
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FarmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;