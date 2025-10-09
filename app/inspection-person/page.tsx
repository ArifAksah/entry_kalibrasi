import InspectionPersonCRUD from '../ui/dashboard/inspection-person-crud';
import Breadcrumb from '../../components/ui/Breadcrumb';

const InspectionPersonPage: React.FC = () => {
  return (
    <ProtectedRoute>
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <SideNav />
        <div className="bg-gray-50">
          <Header />
          <div className="p-6 max-w-7xl mx-auto">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Personel' }]} />
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Personel Management</h1>
            <InspectionPersonCRUD />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default InspectionPersonPage;












