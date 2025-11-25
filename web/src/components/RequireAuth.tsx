import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../hooks/useAuth';
import { adminHomePath } from '../config/appVersion';

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();
  const requestedPath = `${location.pathname}${location.search ?? ''}`;
  const fallbackRoute = user?.role === 'driver' ? '/invoice' : adminHomePath;

  if (!user) {
    return <Navigate to="/login" state={{ from: requestedPath }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
