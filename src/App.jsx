import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from "./pages/register/RegisterPage";
import CustomerForm from "./pages/register/CustomerForm";
import OrganizerForm from "./pages/register/OrganizerForm";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/customer" element={<CustomerForm />} />
        <Route path="/register/organizer" element={<OrganizerForm />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;