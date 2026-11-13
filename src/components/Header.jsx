import { Link, NavLink } from 'react-router-dom';
import AccountMenu from './AccountMenu.jsx';

export default function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">🏡 Property EOI Portal</Link>
        <nav className="nav">
          <NavLink to="/" end>Search</NavLink>
          <NavLink to="/eois">My EOIs</NavLink>
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}
