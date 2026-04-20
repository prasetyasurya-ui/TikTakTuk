import CustomerDashboard from "./CustomerDashboard";
import AdminDashboard from "./AdminDashboard";
import OrganizerDashboard from "./OrganizerDashboard";

const DashboardPage = () => {
  const role = localStorage.getItem('userRole') || 'customer';

  if (role === 'admin') return <AdminDashboard />;
  if (role === 'organizer') return <OrganizerDashboard />;
    
  return <CustomerDashboard />;
};

export default DashboardPage;