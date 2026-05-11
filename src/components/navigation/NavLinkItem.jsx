import React from 'react';
import { Link } from 'react-router-dom';

const NavLinkItem = ({ to, label }) => (
  <Link
    to={to}
    className="text-slate-600 hover:text-blue-600 font-semibold text-xs whitespace-nowrap transition-colors"
  >
    {label}
  </Link>
);

export default NavLinkItem;
