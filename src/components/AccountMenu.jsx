import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AccountMenu() {
  const { status, user, signOut } = useAuth();
  if (status === 'loading') return null;
  if (!user) return <Link to="/login" className="account-link">Sign in</Link>;
  return (
    <span className="account">
      <span className="account-name" title={user.email}>{user.name}</span>
      <button type="button" className="link-btn account-out" onClick={signOut}>Sign out</button>
    </span>
  );
}