import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from "./pages/register/RegisterPage";
import CustomerForm from "./pages/register/CustomerForm";
import OrganizerForm from "./pages/register/OrganizerForm";
import DashboardPage from "./pages/dashboard/DashboardPage";
import AdminDashboard from './pages/dashboard/AdminDashboard';
import OrganizerDashboard from './pages/dashboard/OrganizerDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/customer" element={<CustomerForm />} />
        <Route path="/register/organizer" element={<OrganizerForm />} />

        <Route path='/dashboard' element={<DashboardPage />}></Route>
        <Route path='/dashboard/admin' element={<AdminDashboard />}></Route>
        <Route path='/dashboard/organizer' element={<OrganizerDashboard />}></Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;