import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface RequireAuthProps {
  children: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const requestedPath = `${location.pathname}${location.search ?? ''}`;

  if (!user) {
    return <Navigate to="/login" state={{ from: requestedPath }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
