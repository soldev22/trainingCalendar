const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'client'], default: 'client' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
