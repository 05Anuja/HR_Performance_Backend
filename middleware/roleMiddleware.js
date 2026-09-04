/**
 * Middleware to restrict route access based on user roles.
 * Must be used after authMiddleware to ensure req.user is populated.
 *
 * @param {...string} roles - The roles allowed to access the route
 */
// const checkRole = (...roles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({
//         message: "Unauthorized. Authentication required.",
//       });
//     }

//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({
//         message: "Forbidden. You do not have permission to access this resource.",
//       });
//     }

//     next();
//   };
// };

// module.exports = checkRole;

const checkRole = (...roles) => {
  return (req, res, next) => {
    console.log("User:", req.user);
    console.log("User role:", req.user?.role);
    console.log("Allowed roles:", roles);

    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized. Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message:
          "Forbidden. You do not have permission to access this resource.",
      });
    }

    next();
  };
};

module.exports = checkRole;
