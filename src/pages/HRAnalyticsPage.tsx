import { Navigate } from 'react-router-dom';

export default function HRAnalyticsPage() {
  // Redirect to diagnostic monitoring page
  return <Navigate to="/hr/diagnostic-monitoring" replace />;
}
