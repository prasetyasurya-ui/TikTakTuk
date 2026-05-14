import CustomerDashboard from "./CustomerDashboard";
import AdminDashboard from "./AdminDashboard";
import OrganizerDashboard from "./OrganizerDashboard";
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    // Check if user is authenticated
    if (!session.isLoggedIn || !session.userId) {
      navigate('/login', { replace: true });
      return;
    }
  }, [session.isLoggedIn, session.userId, navigate]);

  const role = session.userRole || 'customer';

  if (role === 'admin') return <AdminDashboard />;
  if (role === 'organizer') return <OrganizerDashboard />;
    
  return <CustomerDashboard />;
};

export default DashboardPage;