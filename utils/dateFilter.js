/**
 * Builds a Mongoose query object for date filtering based on query parameters.
 * Supports exact matching for a single 'date' or range matching with 'startDate' and/or 'endDate'.
 * 
 * @param {Object} query - The request query parameters (req.query)
 * @param {string} dateField - The target database field (e.g., 'createdAt', 'timestamp')
 * @returns {Object} Mongoose filter query object
 */
const buildDateFilter = (query, dateField = "createdAt") => {
  const filter = {};
  
  if (query.startDate || query.endDate) {
    filter[dateField] = {};
    if (query.startDate) {
      filter[dateField].$gte = new Date(query.startDate);
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999); // Include the complete end day
      filter[dateField].$lte = end;
    }
  } else if (query.date) {
    const start = new Date(query.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(query.date);
    end.setHours(23, 59, 59, 999);
    filter[dateField] = {
      $gte: start,
      $lte: end
    };
  }
  
  return filter;
};

module.exports = buildDateFilter;
