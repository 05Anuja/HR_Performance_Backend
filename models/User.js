const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    ecn: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function(v) {
          return /^\d{5}$/.test(v); // 5-digit number constraint
        },
        message: props => `${props.value} is not a valid 5-digit ECN number!`
      }
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["superadmin", "hr"],
      default: "hr",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      required: true, // <-- Strictly required in the schema
      default: "active",
    },

    projects: [
      {
        type: String,
        enum: ["Silgate", "Talent Corner"]
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
