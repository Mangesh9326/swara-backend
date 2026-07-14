export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role_name) {
      return res.status(403).json({ error: 'Access denied: Role not identified' });
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }

    next();
  };
};