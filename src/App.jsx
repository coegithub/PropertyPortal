import { Routes, Route, Link } from 'react-router-dom';
import Header from './components/Header.jsx';
import Toast from './components/Toast.jsx';
import Home from './pages/Home.jsx';
import CommunityDetail from './pages/CommunityDetail.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import UnitDetail from './pages/UnitDetail.jsx';
import EoiForm from './pages/EoiForm.jsx';
import Eois from './pages/Eois.jsx';
import EoiDetail from './pages/EoiDetail.jsx';
import Login from './pages/Login.jsx';
import RequireAuth from './components/RequireAuth.jsx';

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/community/:id" element={<CommunityDetail />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/unit/:id" element={<UnitDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/eoi/new" element={<RequireAuth><EoiForm /></RequireAuth>} />
          <Route path="/eois" element={<RequireAuth><Eois /></RequireAuth>} />
          <Route path="/eois/:id" element={<RequireAuth><EoiDetail /></RequireAuth>} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h2>Page not found</h2>
                <Link to="/" className="btn">Back to search</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="footer">© {new Date().getFullYear()} Property EOI Portal</footer>
      <Toast />
    </>
  );
}
