// const AuditLog = require("../models/AuditLog");
// const buildDateFilter = require("../utils/dateFilter");

// exports.getAuditLogs = async (req, res) => {
//   try {
//     const { search } = req.query;

//     // Apply centralized date filtering (on "timestamp" field)
//     const dateQuery = buildDateFilter(req.query, "timestamp");
//     const query = { ...dateQuery };

//     if (search) {
//       const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
//       const User = require("../models/User");
//       const users = await User.find({
//         $or: [
//           { name: { $regex: escapedSearch, $options: "i" } },
//           { ecn: { $regex: escapedSearch, $options: "i" } },
//         ],
//       }).select("_id");
//       const userIds = users.map((u) => u._id);

//       query.$or = [
//         { action: { $regex: escapedSearch, $options: "i" } },
//         { details: { $regex: escapedSearch, $options: "i" } },
//         { performedBy: { $in: userIds } },
//       ];
//     }

//     const total = await AuditLog.countDocuments(query);

//     const page = req.query.page ? parseInt(req.query.page) : null;
//     let limit =
//       req.query.limit === "all"
//         ? null
//         : req.query.limit
//           ? parseInt(req.query.limit)
//           : null;

//     if (page && !limit) {
//       limit = 10;
//     }

//     let mongooseQuery = AuditLog.find(query)
//       .populate("performedBy", "name ecn") // Swapped email to ecn
//       .sort({ timestamp: -1 });

//     if (page && limit) {
//       const skip = (page - 1) * limit;
//       mongooseQuery = mongooseQuery.skip(skip).limit(limit);
//     }

//     const logs = await mongooseQuery;

//     res.status(200).json({
//       logs,
//       currentPage: page || 1,
//       totalPages: limit ? Math.ceil(total / limit) : 1,
//       totalLogs: total,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

const AuditLog = require("../models/AuditLog");
const buildDateFilter = require("../utils/dateFilter");

exports.getAuditLogs = async (req, res) => {
  try {
    const { search } = req.query;

    // -----------------------------------------
    // 1. Date filter
    // -----------------------------------------
    const dateQuery = buildDateFilter(req.query, "timestamp");

    const query = {
      ...dateQuery,
    };

    // -----------------------------------------
    // 2. ROLE-BASED ACCESS
    // -----------------------------------------

    if (req.user.role === "hr") {
      // HR can see ONLY their own audit logs
      query.performedBy = req.user.id;
    }

    // Superadmin:
    // No performedBy restriction
    // Therefore superadmin gets ALL audit logs

    // -----------------------------------------
    // 3. Search
    // -----------------------------------------

    if (search) {
      const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

      const User = require("../models/User");

      const users = await User.find({
        $or: [
          {
            name: {
              $regex: escapedSearch,
              $options: "i",
            },
          },
          {
            ecn: {
              $regex: escapedSearch,
              $options: "i",
            },
          },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);

      // -----------------------------------------
      // IMPORTANT:
      // Don't overwrite the HR performedBy filter
      // -----------------------------------------

      const searchConditions = [
        {
          action: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          details: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          performedBy: {
            $in: userIds,
          },
        },
      ];

      query.$and = [
        ...(query.$and || []),
        {
          $or: searchConditions,
        },
      ];
    }

    // -----------------------------------------
    // 4. Total logs
    // -----------------------------------------

    const total = await AuditLog.countDocuments(query);

    // -----------------------------------------
    // 5. Pagination
    // -----------------------------------------

    const page = req.query.page ? parseInt(req.query.page) : null;

    let limit =
      req.query.limit === "all"
        ? null
        : req.query.limit
          ? parseInt(req.query.limit)
          : null;

    if (page && !limit) {
      limit = 10;
    }

    // -----------------------------------------
    // 6. Query
    // -----------------------------------------

    let mongooseQuery = AuditLog.find(query)
      .populate("performedBy", "name ecn")
      .sort({ timestamp: -1 });

    // -----------------------------------------
    // 7. Pagination
    // -----------------------------------------

    if (page && limit) {
      const skip = (page - 1) * limit;

      mongooseQuery = mongooseQuery.skip(skip).limit(limit);
    }

    // -----------------------------------------
    // 8. Execute
    // -----------------------------------------

    const logs = await mongooseQuery;

    // -----------------------------------------
    // 9. Response
    // -----------------------------------------

    res.status(200).json({
      logs,
      currentPage: page || 1,
      totalPages: limit ? Math.ceil(total / limit) : 1,
      totalLogs: total,
    });
  } catch (error) {
    console.error("Get Audit Logs Error:", error);

    res.status(500).json({
      message: error.message,
    });
  }
};
