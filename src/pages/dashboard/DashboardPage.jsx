import CustomerDashboard from "./CustomerDashboard";
import AdminDashboard from "./AdminDashboard";
import OrganizerDashboard from "./OrganizerDashboard";
import { useAuth } from '../../contexts/AuthContext';

const DashboardPage = () => {
  const { session } = useAuth();
  const role = session.userRole || 'customer';

  if (role === 'admin') return <AdminDashboard />;
  if (role === 'organizer') return <OrganizerDashboard />;
    
  return <CustomerDashboard />;
};

export default DashboardPage;