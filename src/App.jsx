import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from "./pages/register/RegisterPage";
import CustomerForm from "./pages/register/CustomerForm";
import OrganizerForm from "./pages/register/OrganizerForm";
import DashboardPage from "./pages/dashboard/DashboardPage";
import AdminDashboard from './pages/dashboard/AdminDashboard';
import OrganizerDashboard from './pages/dashboard/OrganizerDashboard';
import VenuePage from './pages/Venue/VenuePage';
import EventPage from './pages/Event/EventPage';
import EventManagementPage from './pages/Event/EventManagementPage';
import ProfilePage from './pages/ProfilePage';
import PlaceholderPage from './pages/PlaceholderPage';
import AdminForm from './pages/register/AdminForm';
import OrderPage from './pages/order/OrderPage';
import AssetOrdersPage from './pages/order/AssetOrdersPage';
import ArtistPage from './pages/Artist/ArtistPage';
import TicketCategoryPage from './pages/TicketCategory/TicketCategoryPage';
import CheckoutPage from './pages/order/CheckoutPage';
import PromotionPage from './pages/promotion/PromotionPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/customer" element={<CustomerForm />} />
        <Route path="/register/organizer" element={<OrganizerForm />} />
        <Route path="/register/admin" element={<AdminForm/>} />

        <Route path='/dashboard' element={<DashboardPage />} />
        <Route path='/dashboard/admin' element={<AdminDashboard />} />
        <Route path='/dashboard/organizer' element={<OrganizerDashboard />} />

        <Route path='/venue' element={<VenuePage />} />
        <Route path='/manage-event' element={<EventManagementPage />} />
        <Route path='/event' element={<EventPage />} />
        <Route path='/profile' element={<ProfilePage />} />
        <Route path='/manage-seats' element={<PlaceholderPage />} />
        <Route path='/ticket-categories' element={<TicketCategoryPage />} />
        <Route path='/manage-tickets' element={<PlaceholderPage />} />
        <Route path='/orders' element={<OrderPage />} />
        <Route path='/checkout/:eventId' element={<CheckoutPage />} />
        <Route path='/asset-tickets' element={<PlaceholderPage />} />
        <Route path='/asset-orders' element={<AssetOrdersPage />} />
        <Route path='/my-tickets' element={<PlaceholderPage />} />
        <Route path='/promotion' element={<PromotionPage />} />
        <Route path='/artist' element={<ArtistPage />} />
        <Route path='/explore' element={<EventPage />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
