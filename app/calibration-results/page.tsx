import CalibrationResultsCRUD from '../ui/dashboard/calibration-results-crud';
import Breadcrumb from '../../components/ui/Breadcrumb';

const CalibrationResultsPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Calibration Results' }]} />
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Calibration Results Management</h1>
            <CalibrationResultsCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default CalibrationResultsPage;










